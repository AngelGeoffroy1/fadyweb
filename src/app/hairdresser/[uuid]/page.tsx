import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/types'
import HairdresserDeepLinkClient from './client'

type Hairdresser = Database['public']['Tables']['hairdressers']['Row']

interface PageProps {
  params: { uuid: string }
}

async function getHairdresser(uuid: string): Promise<Hairdresser | null> {
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

  return data
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
