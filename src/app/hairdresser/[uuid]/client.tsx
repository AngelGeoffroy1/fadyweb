'use client'

import { useEffect } from 'react'
import { Database } from '@/lib/supabase/types'

type Hairdresser = Database['public']['Tables']['hairdressers']['Row']

interface HairdresserDeepLinkClientProps {
  hairdresser: Hairdresser
}

const APP_STORE_URL = 'https://apps.apple.com/fr/app/fady-coiffure/id6754072839'

export default function HairdresserDeepLinkClient({ hairdresser }: HairdresserDeepLinkClientProps) {
  useEffect(() => {
    // Tenter d'ouvrir l'app via le custom URL scheme
    const appDeepLink = `com.fady.com.fady://hairdresser/${hairdresser.id}`

    // Créer un iframe invisible pour tenter d'ouvrir l'app
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = appDeepLink
    document.body.appendChild(iframe)

    // Timer pour détecter si l'app s'est ouverte
    const startTime = Date.now()

    // Si après 2,5 secondes l'app ne s'est pas ouverte, rediriger vers App Store
    const redirectTimer = setTimeout(() => {
      // Si la page est toujours visible (app ne s'est pas ouverte)
      if (!document.hidden && Date.now() - startTime >= 2500) {
        window.location.href = APP_STORE_URL
      }
    }, 2500)

    // Si l'utilisateur quitte la page (l'app s'est ouverte), annuler la redirection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(redirectTimer)
      }
    }

    // Détecter quand l'utilisateur quitte la page (app s'ouvre)
    const handleBlur = () => {
      clearTimeout(redirectTimer)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      clearTimeout(redirectTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe)
      }
    }
  }, [hairdresser.id])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <div className="text-center space-y-6">
        {/* Logo Fady */}
        <div>
          <h1 className="text-5xl font-bold text-gray-900 mb-2">Fady</h1>
          <p className="text-gray-600">Réservez votre coiffeur en quelques clics</p>
        </div>

        {/* Message de chargement */}
        <div className="py-8">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-gray-900 mb-4"></div>
          <p className="text-xl text-gray-700 font-medium">Ouverture de l'application...</p>
          <p className="text-sm text-gray-500 mt-2">Vous allez être redirigé vers l'App Store si l'application n'est pas installée</p>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm pt-8">
          <p>&copy; 2024 Fady. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  )
}
