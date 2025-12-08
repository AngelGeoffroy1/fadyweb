'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { 
  Scissors, 
  Star, 
  MapPin, 
  Phone, 
  Euro, 
  Calendar, 
  Clock, 
  Home, 
  User, 
  MessageCircle,
  Award,
  FileText,
  ArrowLeft,
  Image as ImageIcon
} from 'lucide-react'
import { Database } from '@/lib/supabase/types'

type Hairdresser = Database['public']['Tables']['hairdressers']['Row']
type HairdresserService = Database['public']['Tables']['hairdresser_services']['Row']
type HairdresserAvailability = Database['public']['Tables']['hairdresser_availability']['Row']
type HairdresserGallery = Database['public']['Tables']['hairdresser_gallery']['Row']
type Booking = Database['public']['Tables']['bookings']['Row'] & {
  user_name?: string
  service_name?: string
}
type Review = Database['public']['Tables']['reviews']['Row'] & {
  user_name?: string
}
type DiplomaVerification = Database['public']['Tables']['hairdresser_diploma_verification']['Row']
type Conversation = Database['public']['Tables']['conversations']['Row']

interface HairdresserDetails {
  hairdresser: Hairdresser | null
  services: HairdresserService[]
  availability: HairdresserAvailability[]
  gallery: HairdresserGallery[]
  bookings: Booking[]
  reviews: Review[]
  diplomaVerification: DiplomaVerification | null
  conversations: Conversation[]
}

export default function HairdresserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const hairdresserId = params.id as string
  const [data, setData] = useState<HairdresserDetails>({
    hairdresser: null,
    services: [],
    availability: [],
    gallery: [],
    bookings: [],
    reviews: [],
    diplomaVerification: null,
    conversations: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (hairdresserId) {
      fetchHairdresserDetails()
    }
  }, [hairdresserId])

  const fetchHairdresserDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Récupérer les informations du coiffeur
      const { data: hairdresser, error: hairdresserError } = await supabase
        .from('hairdressers')
        .select('*')
        .eq('id', hairdresserId)
        .single()

      if (hairdresserError) throw hairdresserError
      if (!hairdresser) throw new Error('Coiffeur non trouvé')

      // Récupérer les services
      const { data: services, error: servicesError } = await supabase
        .from('hairdresser_services')
        .select('*')
        .eq('hairdresser_id', hairdresserId)
        .order('created_at', { ascending: false })

      if (servicesError) throw servicesError

      // Récupérer les disponibilités
      const { data: availability, error: availabilityError } = await supabase
        .from('hairdresser_availability')
        .select('*')
        .eq('hairdresser_id', hairdresserId)
        .order('slot_order', { ascending: true })
        .order('day_of_week', { ascending: true })

      if (availabilityError) throw availabilityError

      // Récupérer la galerie
      const { data: gallery, error: galleryError } = await supabase
        .from('hairdresser_gallery')
        .select('*')
        .eq('hairdresser_id', hairdresserId)
        .order('display_order', { ascending: true })

      if (galleryError) throw galleryError

      // Récupérer les réservations avec les noms des clients et services
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          users:user_id(full_name),
          hairdresser_services:service_id(service_name)
        `)
        .eq('hairdresser_id', hairdresserId)
        .order('booking_date', { ascending: false })

      if (bookingsError) throw bookingsError

      // Transformer les données des réservations
      const transformedBookings: Booking[] = (bookings || []).map(booking => ({
        ...booking,
        user_name: booking.users?.full_name || 'Client inconnu',
        service_name: booking.hairdresser_services?.service_name || 'Service inconnu'
      }))

      // Récupérer les avis avec les noms des utilisateurs
      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          users:user_id(full_name)
        `)
        .eq('hairdresser_id', hairdresserId)
        .order('created_at', { ascending: false })

      if (reviewsError) throw reviewsError

      // Transformer les données des avis
      const transformedReviews: Review[] = (reviews || []).map(review => ({
        ...review,
        user_name: review.users?.full_name || 'Client anonyme'
      }))

      // Récupérer la vérification du diplôme
      const { data: diplomaVerification, error: diplomaError } = await supabase
        .from('hairdresser_diploma_verification')
        .select('*')
        .eq('hairdresser_id', hairdresserId)
        .single()

      if (diplomaError && diplomaError.code !== 'PGRST116') throw diplomaError

      // Récupérer les conversations
      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .eq('hairdresser_id', hairdresserId)

      if (conversationsError) throw conversationsError

      setData({
        hairdresser,
        services: services || [],
        availability: availability || [],
        gallery: gallery || [],
        bookings: transformedBookings,
        reviews: transformedReviews,
        diplomaVerification: diplomaVerification || null,
        conversations: conversations || []
      })

    } catch (error) {
      console.error('Erreur lors du chargement des détails du coiffeur:', error)
      setError(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

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
    if (!rating) return 'N/A'
    return (
      <div className="flex items-center space-x-1">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    )
  }

  const getDayName = (dayOfWeek: number) => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    return days[dayOfWeek]
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'past':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Erreur</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => router.push('/dashboard/hairdressers')}>
                Retour à la liste des coiffeurs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data.hairdresser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Coiffeur non trouvé</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header avec bouton retour */}
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{data.hairdresser.name}</h1>
          <p className="text-muted-foreground">Détails du profil coiffeur</p>
        </div>
      </div>

      {/* En-tête du profil */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardContent className="p-0">
            {/* Image de couverture */}
            {data.hairdresser.cover_image_url && (
              <div className="h-48 w-full overflow-hidden rounded-t-lg">
                <img
                  src={data.hairdresser.cover_image_url}
                  alt={`Couverture de ${data.hairdresser.name}`}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            
            <div className="p-6">
              <div className="flex items-start space-x-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {data.hairdresser.avatar_url ? (
                    <img
                      src={data.hairdresser.avatar_url}
                      alt={data.hairdresser.name}
                      className="h-24 w-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                      <Scissors className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Informations principales */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-2xl font-bold">{data.hairdresser.name}</h2>
                    {getStatusBadge(data.hairdresser.statut)}
                    {getRatingStars(data.hairdresser.rating)}
                  </div>

                  {data.hairdresser.description && (
                    <p className="text-muted-foreground">{data.hairdresser.description}</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{data.hairdresser.address}</span>
                    </div>
                    
                    {data.hairdresser.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{data.hairdresser.phone}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Home className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {data.hairdresser.accepts_home_service ? 'Accepte les services à domicile' : 'Services à domicile non disponibles'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Home className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {data.hairdresser.accepts_salon_service ? 'Accepte les services en salon' : 'Services en salon non disponibles'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>
                        Disponible maintenant: {data.hairdresser.available_now ? (
                          <Badge variant="default" className="bg-green-100 text-green-800 ml-2">Oui</Badge>
                        ) : (
                          <Badge variant="secondary" className="ml-2">Non</Badge>
                        )}
                      </span>
                    </div>

                    {data.hairdresser.available_now_end_at && (
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>
                          Disponible jusqu'à: {new Date(data.hairdresser.available_now_end_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>
                        Intervalle minimum: {data.hairdresser.minimum_interval_time} minutes
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Services proposés */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Scissors className="w-5 h-5" />
              <span>Services proposés ({data.services.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.services.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Prix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.service_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{service.service_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{service.duration_minutes} min</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Euro className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{service.price || 'N/A'}€</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucun service proposé</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Disponibilités */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Disponibilités ({data.availability.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.availability.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jour</TableHead>
                    <TableHead>Heure de début</TableHead>
                    <TableHead>Heure de fin</TableHead>
                    <TableHead>Ordre</TableHead>
                    <TableHead>Disponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.availability.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="font-medium">{getDayName(slot.day_of_week)}</TableCell>
                      <TableCell>{slot.start_time}</TableCell>
                      <TableCell>{slot.end_time}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{slot.slot_order}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={slot.is_available ? "default" : "secondary"}>
                          {slot.is_available ? 'Disponible' : 'Indisponible'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucune disponibilité définie</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Galerie photos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ImageIcon className="w-5 h-5" />
              <span>Galerie médias ({data.gallery.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.gallery.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.gallery.map((media) => (
                  <div key={media.id} className="space-y-2">
                    <div className="relative">
                      {media.media_type === 'video' ? (
                        <video
                          src={media.image_url}
                          controls
                          className="w-full h-48 object-cover rounded-lg"
                        >
                          Votre navigateur ne supporte pas la lecture de vidéos.
                        </video>
                      ) : (
                        <img
                          src={media.image_url}
                          alt={media.caption || 'Image de la galerie'}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      )}
                      {media.featured && (
                        <Badge className="absolute top-2 right-2 bg-yellow-500 text-white">
                          En vedette
                        </Badge>
                      )}
                      {media.media_type && (
                        <Badge variant="outline" className="absolute top-2 left-2">
                          {media.media_type === 'video' ? 'Vidéo' : 'Image'}
                        </Badge>
                      )}
                    </div>
                    {media.caption && (
                      <p className="text-sm text-muted-foreground">{media.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucun média dans la galerie</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Réservations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Réservations ({data.bookings.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.bookings.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Heure</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Lieu</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Prix</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>{new Date(booking.booking_date).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>{booking.booking_time}</TableCell>
                        <TableCell>{booking.user_name}</TableCell>
                        <TableCell>{booking.service_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {booking.location_type === 'home' ? 'À domicile' : 'En salon'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(booking.status || 'pending')}>
                            {booking.status || 'En attente'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Euro className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{booking.total_price}€</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucune réservation</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Avis clients */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="w-5 h-5" />
              <span>Avis clients ({data.reviews.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.reviews.length > 0 ? (
              <div className="space-y-4">
                {data.reviews.map((review) => (
                  <div key={review.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{review.user_name || 'Client anonyme'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-muted-foreground">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucun avis client</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Vérification du diplôme */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="w-5 h-5" />
              <span>Vérification du diplôme</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.diplomaVerification ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Badge className={getVerificationStatusColor(data.diplomaVerification.verification_status)}>
                    {data.diplomaVerification.verification_status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Attestation acceptée: {data.diplomaVerification.has_accepted_attestation ? 'Oui' : 'Non'}
                  </span>
                </div>

                {data.diplomaVerification.submitted_at && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      Soumis le: {new Date(data.diplomaVerification.submitted_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}

                {data.diplomaVerification.verified_at && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      Vérifié le: {new Date(data.diplomaVerification.verified_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}

                {data.diplomaVerification.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>Raison du rejet:</strong> {data.diplomaVerification.rejection_reason}
                    </p>
                  </div>
                )}

                {data.diplomaVerification.diploma_file_url && (
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={data.diplomaVerification.diploma_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Voir le diplôme
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucune vérification de diplôme</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Conversations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" />
              <span>Conversations ({data.conversations.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.conversations.length > 0 ? (
              <div className="space-y-2">
                {data.conversations.map((conversation) => (
                  <div key={conversation.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Conversation #{conversation.id.slice(0, 8)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {conversation.created_at && new Date(conversation.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucune conversation</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
