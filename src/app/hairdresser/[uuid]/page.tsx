import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/types'
import HairdresserDeepLinkClient from './client'

type Hairdresser = Database['public']['Tables']['hairdressers']['Row']

interface PageProps {
  params: { uuid: string }
}

async function getHairdresser(uuid: string): Promise<Hairdresser | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('hairdressers')
      .select('*')
      .eq('id', uuid)
      .single()

    if (error) {
      console.error('Error fetching hairdresser:', error)
      return null
    }

    // Normaliser les données pour éviter les problèmes de sérialisation
    if (data) {
      return {
        ...data,
        rating: data.rating !== null ? Number(data.rating) : null,
        total_reviews: data.total_reviews !== null ? Number(data.total_reviews) : null,
        minimum_interval_time: Number(data.minimum_interval_time),
        accepts_home_service: Boolean(data.accepts_home_service),
        accepts_salon_service: Boolean(data.accepts_salon_service),
        available_now: Boolean(data.available_now),
      }
    }

    return data
  } catch (error) {
    console.error('Exception in getHairdresser:', error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { uuid } = params
  const hairdresser = await getHairdresser(uuid)

  if (!hairdresser) {
    return {
      title: 'Coiffeur non trouvé - Fady',
      description: 'Ce profil de coiffeur n\'existe pas.'
    }
  }

  return {
    title: `${hairdresser.name} - Fady`,
    description: hairdresser.description || `Découvrez le profil de ${hairdresser.name} sur Fady`,
    openGraph: {
      title: `${hairdresser.name} - Fady`,
      description: hairdresser.description || `Découvrez le profil de ${hairdresser.name} sur Fady`,
      images: hairdresser.avatar_url ? [hairdresser.avatar_url] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${hairdresser.name} - Fady`,
      description: hairdresser.description || `Découvrez le profil de ${hairdresser.name} sur Fady`,
      images: hairdresser.avatar_url ? [hairdresser.avatar_url] : [],
    }
  }
}

export default async function HairdresserPage({ params }: PageProps) {
  const { uuid } = params
  const hairdresser = await getHairdresser(uuid)

  if (!hairdresser) {
    notFound()
  }

  return <HairdresserDeepLinkClient hairdresser={hairdresser} />
}
