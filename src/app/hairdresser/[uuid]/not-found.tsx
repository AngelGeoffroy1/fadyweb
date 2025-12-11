import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Scissors, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        {/* En-tête avec logo Fady */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Fady</h1>
          <p className="text-gray-600">Réservez votre coiffeur en quelques clics</p>
        </div>

        {/* Message d'erreur */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center">
                <Scissors className="h-12 w-12 text-gray-400" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl">Coiffeur non trouvé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              Désolé, ce profil de coiffeur n'existe pas ou a été supprimé.
            </p>

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full flex items-center justify-center space-x-2"
                onClick={() => {
                  // TODO: Remplacer par le vrai lien App Store
                  window.location.href = 'https://apps.apple.com/app/fady/idXXXXXXXXX'
                }}
              >
                <Home className="w-5 h-5" />
                <span>Télécharger l'application</span>
              </Button>

              <Link href="/">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                >
                  Retour à l'accueil
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm pt-8">
          <p>&copy; 2024 Fady. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  )
}
