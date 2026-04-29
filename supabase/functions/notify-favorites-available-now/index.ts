// Edge Function pour notifier les clients favoris quand un coiffeur devient disponible maintenant
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔔 Received notify-favorites-available-now request');
    
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
    const { hairdresserId } = await req.json();
    console.log('📋 Request data:', { hairdresserId });

    if (!hairdresserId) {
      return new Response(
        JSON.stringify({ error: 'Missing hairdresserId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Créer le client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer les informations du coiffeur
    const { data: hairdresser, error: hairdresserError } = await supabaseClient
      .from('hairdressers')
      .select('name')
      .eq('id', hairdresserId)
      .single();

    if (hairdresserError || !hairdresser) {
      console.error('❌ Error fetching hairdresser:', hairdresserError);
      return new Response(
        JSON.stringify({ error: 'Hairdresser not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Found hairdresser: ${hairdresser.name}`);

    // Récupérer tous les utilisateurs qui ont ce coiffeur en favoris
    const { data: favorites, error: favoritesError } = await supabaseClient
      .from('user_favorites')
      .select('user_id')
      .eq('hairdresser_id', hairdresserId);

    if (favoritesError) {
      console.error('❌ Error fetching favorites:', favoritesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch favorites' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!favorites || favorites.length === 0) {
      console.log('ℹ️ No favorites found for this hairdresser');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No favorites to notify',
          notified: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Found ${favorites.length} users who favorited this hairdresser`);

    // Envoyer une notification à chaque utilisateur via l'Edge Function send-push-notification
    const notificationTitle = `${hairdresser.name} est disponible maintenant !`;
    const notificationBody = `${hairdresser.name} vient d'activer sa disponibilité immédiate. Réservez vite !`;

    const results = await Promise.allSettled(
      favorites.map(async (favorite) => {
        console.log(`📲 Sending notification to user: ${favorite.user_id}`);
        
        // Appeler l'Edge Function send-push-notification
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              userId: favorite.user_id,
              title: notificationTitle,
              body: notificationBody,
              data: {
                type: 'hairdresser_available_now',
                hairdresserId: hairdresserId,
              },
              badge: 1,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to send notification to ${favorite.user_id}: ${errorText}`);
          throw new Error(`Failed to send notification: ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ Notification sent to user ${favorite.user_id}:`, result);
        return result;
      })
    );

    // Compter les succès et échecs
    const successful = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.filter((result) => result.status === 'rejected').length;

    console.log(`📊 Notifications sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        notified: successful,
        failed: failed,
        total: favorites.length,
        hairdresserName: hairdresser.name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Error in notify-favorites-available-now function:', error);
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
