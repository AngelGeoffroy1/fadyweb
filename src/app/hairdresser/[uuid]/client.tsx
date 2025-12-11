'use client'

import { useEffect, useState } from 'react'
import { Database } from '@/lib/supabase/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Scissors,
  Star,
  MapPin,
  Phone,
  Download,
  ExternalLink
} from 'lucide-react'

type Hairdresser = Database['public']['Tables']['hairdressers']['Row']

interface HairdresserDeepLinkClientProps {
  hairdresser: Hairdresser
}

export default function HairdresserDeepLinkClient({ hairdresser }: HairdresserDeepLinkClientProps) {
  const [attemptedRedirect, setAttemptedRedirect] = useState(false)
  const [showAppStore, setShowAppStore] = useState(false)

  useEffect(() => {
    if (!attemptedRedirect) {
      // Essayer d'ouvrir l'app via le custom URL scheme
      const appDeepLink = `com.fady.com.fady://hairdresser/${hairdresser.id}`

      // Créer un iframe invisible pour tenter d'ouvrir l'app
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = appDeepLink
      document.body.appendChild(iframe)

      // Définir un timer pour afficher le bouton App Store si l'app ne s'ouvre pas
      const timer = setTimeout(() => {
        setShowAppStore(true)
        document.body.removeChild(iframe)
      }, 2000)

      // Si l'utilisateur revient sur la page (l'app s'est ouverte puis fermée),
      // on nettoie le timer
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          clearTimeout(timer)
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)

      setAttemptedRedirect(true)

      return () => {
        clearTimeout(timer)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }
    }
  }, [attemptedRedirect, hairdresser.id])

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'Diplomé':
        return <Badge variant="default" className="bg-green-100 text-green-800">Diplomé</Badge>
      case 'Amateur':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Amateur</Badge>
      default:
        return <Badge variant="outline">Non défini</Badge>
    }
  }

  const getRatingStars = (rating: number | null) => {
    if (!rating) return null
    return (
      <div className="flex items-center space-x-1">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* En-tête avec logo Fady */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Fady</h1>
          <p className="text-gray-600">Réservez votre coiffeur en quelques clics</p>
        </div>

        {/* Message de redirection */}
        {!showAppStore && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-gray-600">Ouverture de l'application...</p>
          </div>
        )}

        {/* Profil du coiffeur */}
        <Card className="shadow-lg">
          <CardContent className="p-0">
            {/* Image de couverture */}
            {hairdresser.cover_image_url && (
              <div className="h-48 w-full overflow-hidden rounded-t-lg">
                <img
                  src={hairdresser.cover_image_url}
                  alt={`Couverture de ${hairdresser.name}`}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="p-6">
              <div className="flex items-start space-x-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {hairdresser.avatar_url ? (
                    <img
                      src={hairdresser.avatar_url}
                      alt={hairdresser.name}
                      className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg">
                      <Scissors className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Informations principales */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-3 flex-wrap">
                    <h2 className="text-2xl font-bold text-gray-900">{hairdresser.name}</h2>
                    {getStatusBadge(hairdresser.statut)}
                    {getRatingStars(hairdresser.rating)}
                  </div>

                  {hairdresser.description && (
                    <p className="text-gray-600">{hairdresser.description}</p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{hairdresser.address}</span>
                    </div>

                    {hairdresser.phone && (
                      <div className="flex items-center space-x-2 text-gray-700">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{hairdresser.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Boutons d'action */}
        {showAppStore && (
          <Card className="shadow-lg border-2 border-blue-500">
            <CardHeader>
              <CardTitle className="text-center">Téléchargez l'application Fady</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-gray-600">
                Pour réserver avec {hairdresser.name}, téléchargez l'application Fady sur l'App Store
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  className="flex items-center space-x-2"
                  onClick={() => {
                    // TODO: Remplacer par le vrai lien App Store
                    window.location.href = 'https://apps.apple.com/app/fady/idXXXXXXXXX'
                  }}
                >
                  <Download className="w-5 h-5" />
                  <span>Télécharger sur l'App Store</span>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="flex items-center space-x-2"
                  onClick={() => {
                    const appDeepLink = `com.fady.com.fady://hairdresser/${hairdresser.id}`
                    window.location.href = appDeepLink
                  }}
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>Ouvrir l'app</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm pt-8">
          <p>&copy; 2024 Fady. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  )
}
