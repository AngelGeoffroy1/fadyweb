// Edge Function pour envoyer des notifications push via APNs
// Avec fallback email pour les clients sans device token (guests webapp)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';

// Configuration APNs
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID');
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID');
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID');
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY');
const APNS_URL = Deno.env.get('APNS_URL') || 'https://api.push.apple.com';

// Configuration Resend pour fallback email
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Lien App Store pour l'app Fady Client
const FADY_CLIENT_APP_STORE_URL = 'https://apps.apple.com/fr/app/fady-coiffure/id6754072839';

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Client Supabase global pour le nettoyage des tokens
let supabaseClient: any = null;

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📨 Received push notification request');
    
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
    console.log('📋 Request data:', { userId, title, body, data });

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, title, body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialiser le client Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer les tokens de l'utilisateur
    const { data: deviceTokens, error: tokenError } = await supabaseClient
      .from('user_device_tokens')
      .select('device_token, platform')
      .eq('user_id', userId);

    if (tokenError) {
      console.error('❌ Error fetching device tokens:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Error fetching device tokens' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📱 Found ${deviceTokens?.length || 0} device tokens for user ${userId}`);

    // Si aucun token trouvé, essayer le fallback email pour les messages de chat
    if (!deviceTokens || deviceTokens.length === 0) {
      console.log('⚠️ No device tokens found for user');
      
      // Vérifier si c'est un message de chat (type: "message")
      const notificationType = data?.type;
      
      if (notificationType === 'message') {
        console.log('📧 Attempting email fallback for chat message...');
        
        // Récupérer les informations de l'utilisateur
        const { data: userData, error: userError } = await supabaseClient
          .from('users')
          .select('email, full_name')
          .eq('id', userId)
          .single();
        
        if (userError || !userData?.email) {
          console.error('❌ Could not fetch user email for fallback:', userError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              sent: 0, 
              failed: 0, 
              total: 0,
              fallbackEmail: false,
              reason: 'No device tokens and could not fetch user email'
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        // Envoyer l'email de fallback
        const senderName = data?.senderName || 'Votre coiffeur';
        const emailResult = await sendFallbackEmail(
          userData.email,
          userData.full_name || 'Client',
          senderName,
          body // Le contenu du message
        );
        
        return new Response(
          JSON.stringify({
            success: emailResult.success,
            sent: 0,
            failed: 0,
            total: 0,
            fallbackEmail: true,
            emailSent: emailResult.success,
            emailError: emailResult.error,
            reason: 'No device tokens - sent email fallback'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      // Pour les autres types de notifications, simplement retourner sans erreur
      return new Response(
        JSON.stringify({ 
          success: false, 
          sent: 0, 
          failed: 0, 
          total: 0,
          reason: 'No device tokens found'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Créer le JWT APNs
    const jwt = await createAPNsJWT();
    console.log('🔐 APNs JWT created');

    // Envoyer à chaque token
    let sent = 0;
    let failed = 0;

    for (const { device_token: deviceToken, platform } of deviceTokens) {
      console.log(`📤 Sending to token: ${deviceToken.substring(0, 20)}... (${platform})`);

      const apnsPayload = {
        aps: {
          alert: {
            title: title,
            body: body,
          },
          sound: 'default',
          badge: badge ?? 1,
          'mutable-content': 1,
        },
        ...data,
      };

      try {
        const response = await fetch(`${APNS_URL}/3/device/${deviceToken}`, {
          method: 'POST',
          headers: {
            'authorization': `bearer ${jwt}`,
            'apns-topic': APNS_BUNDLE_ID!,
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'apns-expiration': '0',
            'content-type': 'application/json',
          },
          body: JSON.stringify(apnsPayload),
        });

        if (response.ok) {
          console.log(`✅ Successfully sent to ${deviceToken.substring(0, 20)}...`);
          sent++;
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to send to ${deviceToken.substring(0, 20)}...: ${response.status} - ${errorText}`);
          
          // Si le token est invalide, le supprimer
          if (response.status === 400 || response.status === 410) {
            console.log(`🗑️ Removing invalid token: ${deviceToken.substring(0, 20)}...`);
            await removeInvalidToken(deviceToken);
          }
          
          failed++;
        }
      } catch (err) {
        console.error(`❌ Exception sending to ${deviceToken.substring(0, 20)}...:`, err);
        failed++;
      }
    }

    console.log(`📊 Results: sent=${sent}, failed=${failed}, total=${deviceTokens.length}`);

    return new Response(
      JSON.stringify({
        success: sent > 0,
        sent,
        failed,
        total: deviceTokens.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in push notification function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Fonction pour envoyer un email de fallback aux clients guests
async function sendFallbackEmail(
  email: string,
  clientName: string,
  senderName: string,
  messageContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`📧 Sending fallback email to ${email}`);
    
    if (!RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 32px;
      font-weight: 700;
      color: #BC31FC;
    }
    .message-box {
      background: #f8f4ff;
      border-left: 4px solid #BC31FC;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .sender-name {
      font-weight: 600;
      color: #BC31FC;
      margin-bottom: 8px;
    }
    .message-content {
      font-size: 16px;
      color: #333;
      white-space: pre-wrap;
    }
    .cta-section {
      text-align: center;
      margin-top: 32px;
      padding: 24px;
      background: #fafafa;
      border-radius: 12px;
    }
    .cta-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
    }
    .cta-subtitle {
      color: #666;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .download-button {
      display: inline-block;
      background-color: #BC31FC;
      color: white !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 30px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(188, 49, 252, 0.3);
    }
    .benefits {
      margin-top: 24px;
      text-align: left;
    }
    .benefit-item {
      display: flex;
      align-items: center;
      margin: 8px 0;
      font-size: 14px;
      color: #555;
    }
    .benefit-icon {
      margin-right: 8px;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #eee;
      color: #888;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">✂️ Fady</div>
    </div>
    
    <p>Bonjour ${clientName},</p>
    
    <p><strong>${senderName}</strong> vous a envoyé un message :</p>
    
    <div class="message-box">
      <div class="sender-name">💬 ${senderName}</div>
      <div class="message-content">${messageContent}</div>
    </div>
    
    <div class="cta-section">
      <div class="cta-title">📲 Ne manquez plus aucun message !</div>
      <div class="cta-subtitle">Téléchargez l'app Fady pour répondre facilement et gérer vos rendez-vous.</div>
      <a href="${FADY_CLIENT_APP_STORE_URL}" class="download-button">
        Télécharger l'app Fady
      </a>
      <div class="benefits">
        <div class="benefit-item"><span class="benefit-icon">✨</span> Messagerie instantanée avec votre coiffeur</div>
        <div class="benefit-item"><span class="benefit-icon">📅</span> Réservations en un clic</div>
        <div class="benefit-item"><span class="benefit-icon">🔔</span> Notifications en temps réel</div>
        <div class="benefit-item"><span class="benefit-icon">💜</span> 100% gratuit</div>
      </div>
    </div>
    
    <div class="footer">
      <p>L'équipe Fady ✂️</p>
      <p>Cet email a été envoyé car vous avez une réservation sur Fady.</p>
    </div>
  </div>
</body>
</html>
`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Fady <notifications@fady-app.fr>',
        to: [email],
        subject: `💬 Nouveau message de ${senderName}`,
        html: htmlContent,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Resend error:', result);
      return { success: false, error: result.message || 'Email sending failed' };
    }
    
    console.log('✅ Fallback email sent successfully:', result);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Exception sending fallback email:', error);
    return { success: false, error: error.message };
  }
}

async function removeInvalidToken(deviceToken: string) {
  if (!supabaseClient) {
    console.error('❌ Supabase client not initialized');
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('user_device_tokens')
      .delete()
      .eq('device_token', deviceToken);
    
    if (error) {
      console.error('❌ Error removing invalid token:', error);
    } else {
      console.log(`✅ Successfully removed invalid token: ${deviceToken}`);
    }
  } catch (err) {
    console.error('❌ Exception while removing invalid token:', err);
  }
}

async function createAPNsJWT() {
  try {
    console.log('🔐 Creating APNs JWT...');

    if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
      throw new Error('Missing APNs configuration. Please check your environment variables.');
    }

    const header = {
      alg: 'ES256',
      kid: APNS_KEY_ID,
    };

    const payload = {
      iss: APNS_TEAM_ID,
      iat: getNumericDate(new Date()),
    };

    console.log('📝 JWT Header:', header);
    console.log('📝 JWT Payload:', payload);

    const privateKeyPem = APNS_PRIVATE_KEY;
    console.log('🔑 Private key format check:', privateKeyPem.includes('BEGIN PRIVATE KEY'));

    const base64Key = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');
    console.log('🔑 Base64 key length:', base64Key.length);

    const keyBuffer = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
    console.log('🔑 Key buffer length:', keyBuffer.length);

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    console.log('🔑 Private key imported successfully');

    const jwt = await create(header, payload, privateKey);
    console.log('✅ JWT created successfully');

    return jwt;
  } catch (error) {
    console.error('❌ Error creating APNs JWT:', error);
    throw new Error(`Failed to create JWT: ${error.message}`);
  }
}
