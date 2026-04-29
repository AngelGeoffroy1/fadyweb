import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const NOMINATIM_API = "https://nominatim.openstreetmap.org/search";
const DELAY_MS = 1000; // Nominatim limite: 1 req/sec

interface Hairdresser {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Normalisation des adresses (corrections courantes)
function normalizeAddress(address: string): string {
  return address
    .replace(/Monptellier/gi, 'Montpellier')
    .replace(/Bodreaux/gi, 'Bordeaux')
    .replace(/Tang Frere/gi, 'Tang Frères')
    .replace(/Rue De L Ecol/gi, "Rue de l'École")
    .replace(/\s+bjs\s+/gi, ' bis ')
    .replace(/\s+aller\s+/gi, ' allée ')
    .replace(/\s+impasses\s+/gi, ' impasse ')
    .trim();
}

// Fonction de géocodage avec Nominatim (multi-pays)
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number; corrected?: string } | null> {
  // Essayer avec l'adresse normalisée
  const normalizedAddress = normalizeAddress(address);
  const didNormalize = normalizedAddress !== address;
  
  try {
    // Essai 1 : Adresse complète (France, Belgique, Suisse)
    const url = `${NOMINATIM_API}?q=${encodeURIComponent(normalizedAddress)}&format=json&limit=1&countrycodes=fr,be,ch`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Fady-App-Migration/2.0',
      },
    });

    if (!response.ok) {
      console.error(`❌ Erreur HTTP ${response.status} pour: ${address}`);
      return null;
    }

    const data: NominatimResult[] = await response.json();
    
    if (data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        corrected: didNormalize ? normalizedAddress : undefined,
      };
    }

    // Essai 2 : Si échec, essayer sans restriction de pays (international)
    console.warn(`⚠️ Aucun résultat FR/BE/CH, essai sans restriction...`);
    const urlGlobal = `${NOMINATIM_API}?q=${encodeURIComponent(normalizedAddress)}&format=json&limit=1`;
    
    const responseGlobal = await fetch(urlGlobal, {
      headers: {
        'User-Agent': 'Fady-App-Migration/2.0',
      },
    });

    if (responseGlobal.ok) {
      const dataGlobal: NominatimResult[] = await responseGlobal.json();
      if (dataGlobal.length > 0) {
        const result = dataGlobal[0];
        console.log(`✅ Trouvé hors FR/BE/CH: ${result.display_name}`);
        return {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          corrected: didNormalize ? normalizedAddress : undefined,
        };
      }
    }

    console.warn(`❌ Aucun résultat pour: ${address}`);
    return null;
  } catch (error) {
    console.error(`❌ Erreur géocodage pour ${address}:`, error);
    return null;
  }
}

// Fonction pour attendre
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req: Request) => {
  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialiser Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('🚀 Début de la migration de géocodage (v2 - multi-pays)...');

    // Récupérer tous les coiffeurs sans coordonnées
    const { data: hairdressers, error: fetchError } = await supabaseClient
      .from('hairdressers')
      .select('id, name, address, latitude, longitude')
      .or('latitude.is.null,longitude.is.null');

    if (fetchError) {
      throw new Error(`Erreur récupération coiffeurs: ${fetchError.message}`);
    }

    if (!hairdressers || hairdressers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Aucun coiffeur à géocoder',
          updated: 0,
          failed: 0
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 ${hairdressers.length} coiffeurs à géocoder`);

    let updated = 0;
    let failed = 0;
    const failures: Array<{ name: string; address: string; reason: string }> = [];

    // Traiter chaque coiffeur avec délai
    for (const hairdresser of hairdressers as Hairdresser[]) {
      console.log(`\n🔍 Géocodage: ${hairdresser.name}`);
      console.log(`   📍 Adresse: ${hairdresser.address}`);
      
      const result = await geocodeAddress(hairdresser.address);
      
      if (result) {
        // Mettre à jour dans la DB
        const { error: updateError } = await supabaseClient
          .from('hairdressers')
          .update({
            latitude: result.lat,
            longitude: result.lon,
          })
          .eq('id', hairdresser.id);

        if (updateError) {
          console.error(`❌ Erreur update ${hairdresser.name}:`, updateError);
          failed++;
          failures.push({
            name: hairdresser.name,
            address: hairdresser.address,
            reason: `Erreur DB: ${updateError.message}`,
          });
        } else {
          console.log(`✅ ${hairdresser.name}: ${result.lat}, ${result.lon}`);
          if (result.corrected) {
            console.log(`   🔧 Adresse corrigée: ${result.corrected}`);
          }
          updated++;
        }
      } else {
        console.warn(`❌ Échec géocodage: ${hairdresser.name}`);
        failed++;
        failures.push({
          name: hairdresser.name,
          address: hairdresser.address,
          reason: 'Adresse introuvable (vérifier orthographe/complétude)',
        });
      }

      // Attendre 1 seconde entre chaque requête (rate limit Nominatim)
      await delay(DELAY_MS);
    }

    console.log('\n✅ Migration terminée!');
    console.log(`📊 Résultats: ${updated} succès, ${failed} échecs`);

    if (failures.length > 0) {
      console.log('\n🔴 Adresses à corriger manuellement:');
      failures.forEach(f => {
        console.log(`  - ${f.name}: "${f.address}" → ${f.reason}`);
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: hairdressers.length,
        updated,
        failed,
        failures: failures.length > 0 ? failures : undefined,
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        } 
      }
    );

  } catch (error) {
    console.error('❌ Erreur globale:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur inconnue' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});