import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de Confidentialité et Conditions d\'Utilisation - Fady',
  description: 'Politique de confidentialité et conditions d\'utilisation de l\'application Fady et Fady Pro',
}

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">
            Politique de Confidentialité et Conditions d'Utilisation
          </h1>
          <p className="text-muted-foreground">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Politique de Confidentialité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">1. Politique de Confidentialité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1.1 Collecte des Données</h2>
              <p className="text-muted-foreground mb-3">
                Fady collecte les données suivantes pour fournir ses services :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>Données de profil :</strong> nom, email, numéro de téléphone, photo de profil</li>
                <li><strong>Données de localisation :</strong> adresse, position GPS (pour les services à domicile et la recherche de coiffeurs à proximité)</li>
                <li><strong>Données de réservation :</strong> historique des réservations, préférences de services</li>
                <li><strong>Données de paiement :</strong> informations de carte bancaire traitées de manière sécurisée via Stripe (nous ne stockons pas vos données bancaires)</li>
                <li><strong>Données de communication :</strong> messages échangés avec les coiffeurs via le chat intégré</li>
                <li><strong>Données d'utilisation :</strong> préférences, favoris, avis et notations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">1.2 Utilisation des Données</h2>
              <p className="text-muted-foreground mb-3">
                Vos données sont utilisées pour :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Faciliter la réservation de services de coiffure</li>
                <li>Gérer les paiements de manière sécurisée</li>
                <li>Permettre la communication entre utilisateurs et coiffeurs</li>
                <li>Améliorer l'expérience utilisateur et personnaliser les services</li>
                <li>Envoyer des notifications importantes (confirmations, rappels)</li>
                <li>Analyser l'utilisation de l'application pour améliorer nos services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">1.3 Partage avec des Tiers</h2>
              <p className="text-muted-foreground mb-3">
                Nous partageons vos données uniquement avec :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>Stripe :</strong> pour le traitement sécurisé des paiements. Stripe est conforme aux normes PCI-DSS.</li>
                <li><strong>Supabase :</strong> pour l'hébergement et le stockage sécurisé de vos données.</li>
                <li><strong>Les coiffeurs :</strong> informations nécessaires pour honorer votre réservation (nom, adresse pour services à domicile, contact).</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Nous ne vendons jamais vos données personnelles à des tiers à des fins commerciales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">1.4 Sécurité des Données</h2>
              <p className="text-muted-foreground">
                Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mt-3">
                <li>Chiffrement des données en transit (HTTPS/TLS)</li>
                <li>Authentification sécurisée via Supabase</li>
                <li>Stockage sécurisé des données</li>
                <li>Accès restreint aux données personnelles</li>
                <li>Surveillance régulière de la sécurité</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">1.5 Vos Droits</h2>
              <p className="text-muted-foreground mb-3">
                Conformément au RGPD, vous disposez des droits suivants :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>Droit d'accès :</strong> vous pouvez demander une copie de vos données personnelles</li>
                <li><strong>Droit de rectification :</strong> vous pouvez corriger vos données dans votre profil</li>
                <li><strong>Droit à l'effacement :</strong> vous pouvez demander la suppression de votre compte et de vos données</li>
                <li><strong>Droit à la portabilité :</strong> vous pouvez récupérer vos données dans un format structuré</li>
                <li><strong>Droit d'opposition :</strong> vous pouvez vous opposer au traitement de vos données</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Pour exercer ces droits, contactez-nous à : <a href="mailto:fadyapp33@gmail.com" className="text-primary hover:underline">fadyapp33@gmail.com</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">1.6 Cookies et Technologies Similaires</h2>
              <p className="text-muted-foreground">
                L'application Fady utilise des cookies et technologies similaires pour améliorer votre expérience, 
                mémoriser vos préférences et analyser l'utilisation de l'application. Vous pouvez gérer vos préférences 
                de cookies dans les paramètres de votre appareil.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">1.7 Conservation des Données</h2>
              <p className="text-muted-foreground">
                Nous conservons vos données personnelles aussi longtemps que nécessaire pour fournir nos services 
                et respecter nos obligations légales. Lorsque vous supprimez votre compte, vos données sont supprimées 
                dans un délai de 30 jours, sauf obligation légale de conservation.
              </p>
            </section>
          </CardContent>
        </Card>

        {/* Conditions d'Utilisation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">2. Conditions d'Utilisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">2.1 Acceptation des Conditions</h2>
              <p className="text-muted-foreground">
                En utilisant l'application Fady ou Fady Pro, vous acceptez sans réserve les présentes conditions d'utilisation. 
                Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser l'application.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2.2 Description du Service</h2>
              <p className="text-muted-foreground mb-3">
                Fady est une plateforme de mise en relation permettant aux utilisateurs de :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Rechercher et réserver des services de coiffure auprès de professionnels ou d'amateurs</li>
                <li>Choisir entre des services au salon ou à domicile</li>
                <li>Effectuer des paiements sécurisés pour les services réservés</li>
                <li>Communiquer avec les coiffeurs via le chat intégré</li>
                <li>Consulter et laisser des avis sur les prestations</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Fady agit uniquement comme intermédiaire et n'est pas responsable de la qualité des services fournis par les coiffeurs.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2.3 Compte Utilisateur</h2>
              <p className="text-muted-foreground mb-3">
                Pour utiliser Fady, vous devez :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Créer un compte avec des informations exactes et à jour</li>
                <li>Être âgé d'au moins 18 ans ou avoir l'autorisation d'un parent/tuteur</li>
                <li>Maintenir la confidentialité de vos identifiants de connexion</li>
                <li>Être responsable de toutes les activités effectuées depuis votre compte</li>
                <li>Notifier immédiatement Fady en cas d'utilisation non autorisée de votre compte</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2.4 Réservations</h2>
              <p className="text-muted-foreground mb-3">
                Les réservations sont soumises aux règles suivantes :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Les réservations peuvent être effectuées pour des services immédiats ou planifiés</li>
                <li>Les conditions d'annulation et de remboursement sont définies par chaque coiffeur</li>
                <li>En cas d'annulation tardive ou de non-présentation, des frais peuvent être appliqués</li>
                <li>Fady se réserve le droit d'annuler une réservation en cas de problème technique ou de force majeure</li>
                <li>Les prix affichés sont ceux convenus avec le coiffeur au moment de la réservation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2.5 Paiements</h2>
              <p className="text-muted-foreground mb-3">
                Les paiements sont traités de manière sécurisée via Stripe :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Les paiements sont effectués au moment de la réservation ou selon les modalités convenues</li>
                <li>Les informations de paiement sont sécurisées et conformes aux normes PCI-DSS</li>
                <li>En cas de litige, les remboursements sont traités selon la politique de remboursement du coiffeur</li>
                <li>Fady peut prélever des frais de service sur les transactions</li>
                <li>Les prix sont affichés en euros (€) et incluent la TVA si applicable</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2.6 Avis et Notations</h2>
              <p className="text-muted-foreground mb-3">
                Les utilisateurs peuvent laisser des avis et noter les coiffeurs :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Les avis doivent être authentiques et basés sur une expérience réelle</li>
                <li>Les avis diffamatoires, offensants ou frauduleux sont interdits</li>
                <li>Fady se réserve le droit de modérer et supprimer tout avis inapproprié</li>
                <li>Les coiffeurs peuvent répondre aux avis laissés sur leur profil</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2.7 Propriété Intellectuelle</h2>
              <p className="text-muted-foreground">
                Tous les contenus de l'application Fady (logos, textes, images, design) sont la propriété de Fady 
                ou de ses partenaires. Toute reproduction, distribution ou utilisation non autorisée est interdite.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2.8 Limitation de Responsabilité</h2>
              <p className="text-muted-foreground">
                Fady agit comme intermédiaire et ne peut être tenu responsable :
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mt-3">
                <li>De la qualité des services fournis par les coiffeurs</li>
                <li>Des dommages résultant de l'utilisation ou de l'impossibilité d'utiliser l'application</li>
                <li>Des pertes de données, interruptions de service ou erreurs techniques</li>
                <li>Des litiges entre utilisateurs et coiffeurs</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                L'utilisation de l'application se fait à vos propres risques.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2.9 Modifications des Conditions</h2>
              <p className="text-muted-foreground">
                Fady se réserve le droit de modifier les présentes conditions à tout moment. Les modifications 
                seront notifiées aux utilisateurs et entreront en vigueur dès leur publication. La poursuite de 
                l'utilisation de l'application après modification vaut acceptation des nouvelles conditions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2.10 Contact</h2>
              <p className="text-muted-foreground">
                Pour toute question concernant cette politique de confidentialité ou ces conditions d'utilisation, 
                vous pouvez nous contacter à : <a href="mailto:fadyapp33@gmail.com" className="text-primary hover:underline">fadyapp33@gmail.com</a>
              </p>
            </section>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground pt-8">
          <p>© {new Date().getFullYear()} Fady. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  )
}









