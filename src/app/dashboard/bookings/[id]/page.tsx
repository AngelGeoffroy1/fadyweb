'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { motion } from 'framer-motion'
import { 
  ArrowLeft,
  Calendar,
  Clock,
  Euro,
  MapPin,
  User,
  Mail,
  Phone,
  Star,
  Scissors,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { toast } from 'sonner'
import { sendClientNotification, sendHairdresserNotification, NotificationTemplates } from '@/lib/notifications'

type Booking = Database['public']['Tables']['bookings']['Row'] & {
  user_name?: string
  user_email?: string
  user_phone?: string
  user_avatar_url?: string | null
  hairdresser_name?: string
  hairdresser_phone?: string
  hairdresser_address?: string
  hairdresser_rating?: number
  hairdresser_avatar_url?: string | null
  hairdresser_user_id?: string
  service_name?: string
  duration_minutes?: number
  service_price?: number
}

type Review = Database['public']['Tables']['reviews']['Row'] & {
  user_name?: string
  hairdresser_name?: string
}

interface BookingDetails {
  booking: Booking | null
  review: Review | null
}

export default function BookingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bookingId = params.id as string
  const [data, setData] = useState<BookingDetails>({
    booking: null,
    review: null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (bookingId) {
      fetchBookingDetails()
    }
  }, [bookingId])

  const fetchBookingDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Récupérer les informations de la réservation avec jointures
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          users:user_id(full_name, email, phone, avatar_url),
          hairdressers:hairdresser_id(name, phone, address, rating, avatar_url, user_id),
          hairdresser_services:service_id(service_name, duration_minutes, price)
        `)
        .eq('id', bookingId)
        .single()

      if (bookingError) throw bookingError
      if (!bookingData) throw new Error('Réservation non trouvée')

      const transformedBooking: Booking = {
        ...bookingData,
        user_name: bookingData.users?.full_name || 'N/A',
        user_email: bookingData.users?.email || 'N/A',
        user_phone: bookingData.users?.phone || null,
        user_avatar_url: bookingData.users?.avatar_url || null,
        hairdresser_name: bookingData.hairdressers?.name || 'Coiffeur inconnu',
        hairdresser_phone: bookingData.hairdressers?.phone || null,
        hairdresser_address: bookingData.hairdressers?.address || null,
        hairdresser_rating: bookingData.hairdressers?.rating || 0,
        hairdresser_avatar_url: bookingData.hairdressers?.avatar_url || null,
        hairdresser_user_id: bookingData.hairdressers?.user_id,
        service_name: bookingData.hairdresser_services?.service_name || 'Service inconnu',
        duration_minutes: bookingData.hairdresser_services?.duration_minutes || 0,
        service_price: bookingData.hairdresser_services?.price || 0
      }

      // Récupérer l'avis associé à cette réservation
      const { data: reviewData, error: reviewError } = await supabase
        .from('reviews')
        .select(`
          *,
          users:user_id(full_name),
          hairdressers:hairdresser_id(name)
        `)
        .eq('booking_id', bookingId)
        .single()

      if (reviewError && reviewError.code !== 'PGRST116') throw reviewError

      const transformedReview: Review | null = reviewData ? {
        ...reviewData,
        user_name: reviewData.users?.full_name || 'N/A',
        hairdresser_name: reviewData.hairdressers?.name || 'N/A'
      } : null

      setData({
        booking: transformedBooking,
        review: transformedReview
      })

    } catch (error) {
      console.error('Erreur lors du chargement des détails de la réservation:', error)
      setError(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const updateBookingStatus = async (newStatus: string) => {
    if (!data.booking) return

    try {
      setUpdatingStatus(true)

      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)

      if (error) throw error

      // Mettre à jour l'état local
      setData(prev => ({
        ...prev,
        booking: prev.booking ? { ...prev.booking, status: newStatus } : null
      }))

      // Envoyer les notifications selon le nouveau statut
      const booking = data.booking
      const bookingDate = new Date(booking.booking_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
      const bookingDateTime = `${bookingDate} à ${booking.booking_time}`

      try {
        switch (newStatus) {
          case 'confirmed':
            // Notifier le client
            if (booking.user_id) {
              await sendClientNotification(
                NotificationTemplates.bookingConfirmedClient(
                  booking.user_id,
                  booking.id,
                  booking.hairdresser_name || 'votre coiffeur',
                  bookingDateTime
                )
              )
            }
            // Notifier le coiffeur
            if (booking.hairdresser_user_id) {
              await sendHairdresserNotification(
                NotificationTemplates.bookingConfirmedHairdresser(
                  booking.hairdresser_user_id,
                  booking.id,
                  booking.user_name || 'un client',
                  bookingDateTime
                )
              )
            }
            console.log('✅ Notifications envoyées pour confirmation de réservation')
            break

          case 'cancelled':
            // Notifier le client
            if (booking.user_id) {
              await sendClientNotification(
                NotificationTemplates.bookingCancelledClient(
                  booking.user_id,
                  booking.id,
                  booking.hairdresser_name || 'votre coiffeur',
                  bookingDateTime
                )
              )
            }
            // Notifier le coiffeur
            if (booking.hairdresser_user_id) {
              await sendHairdresserNotification(
                NotificationTemplates.bookingCancelledHairdresser(
                  booking.hairdresser_user_id,
                  booking.id,
                  booking.user_name || 'un client',
                  bookingDateTime
                )
              )
            }
            console.log('✅ Notifications envoyées pour annulation de réservation')
            break

          case 'completed':
            // Notifier le client
            if (booking.user_id) {
              await sendClientNotification(
                NotificationTemplates.bookingCompletedClient(
                  booking.user_id,
                  booking.id,
                  booking.hairdresser_name || 'votre coiffeur'
                )
              )
            }
            // Notifier le coiffeur
            if (booking.hairdresser_user_id) {
              await sendHairdresserNotification(
                NotificationTemplates.bookingCompletedHairdresser(
                  booking.hairdresser_user_id,
                  booking.id,
                  booking.user_name || 'un client',
                  bookingDateTime
                )
              )
            }
            console.log('✅ Notifications envoyées pour réservation terminée')
            break

          default:
            // Pas de notification pour les autres statuts (pending, past)
            break
        }
      } catch (notifError) {
        console.error('❌ Erreur lors de l\'envoi des notifications:', notifError)
        // Ne pas bloquer le processus si les notifications échouent
      }

      toast.success('Statut de la réservation mis à jour avec succès')
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error)
      toast.error('Erreur lors de la mise à jour du statut')
    } finally {
      setUpdatingStatus(false)
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Terminé'
      case 'confirmed':
        return 'Confirmé'
      case 'pending':
        return 'En attente'
      case 'cancelled':
        return 'Annulé'
      case 'past':
        return 'Passé'
      default:
        return status || 'Non défini'
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
              <Button onClick={() => router.push('/dashboard/bookings')}>
                Retour à la liste des réservations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data.booking) {
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
          <h1 className="text-3xl font-bold text-foreground">Réservation non trouvée</h1>
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
          <h1 className="text-3xl font-bold text-foreground">Détails de la réservation</h1>
          <p className="text-muted-foreground">Informations complètes de la réservation</p>
        </div>
      </div>

      {/* Informations principales de la réservation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Informations de la réservation</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Date :</span>
                  <span>{new Date(data.booking.booking_date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Heure :</span>
                  <span>{data.booking.booking_time}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Lieu :</span>
                  <Badge variant="outline">
                    {data.booking.location_type === 'home' ? 'À domicile' : 'En salon'}
                  </Badge>
                </div>

                {data.booking.location_type === 'home' && data.booking.address && (
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-medium">Adresse :</span>
                      <p className="text-sm text-muted-foreground">{data.booking.address}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Euro className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Prix total :</span>
                  <span className="text-lg font-bold">{data.booking.total_price}€</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="font-medium">Statut :</span>
                  <Select 
                    value={data.booking.status || 'pending'} 
                    onValueChange={updateBookingStatus}
                    disabled={updatingStatus}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmé</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                      <SelectItem value="past">Passé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Créé le :</span>
                  <span>{new Date(data.booking.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Informations du client */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Informations du client</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                {data.booking.user_avatar_url ? (
                  <img
                    src={data.booking.user_avatar_url}
                    alt={data.booking.user_name || 'Avatar'}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">{data.booking.user_name}</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{data.booking.user_email}</span>
                  </div>
                  {data.booking.user_phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{data.booking.user_phone}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/users/${data.booking?.user_id}`)}
                >
                  Voir le profil complet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Informations du coiffeur */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Scissors className="w-5 h-5" />
              <span>Informations du coiffeur</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                {data.booking.hairdresser_avatar_url ? (
                  <img
                    src={data.booking.hairdresser_avatar_url}
                    alt={data.booking.hairdresser_name || 'Avatar'}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <Scissors className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">{data.booking.hairdresser_name}</h3>
                  {data.booking.hairdresser_rating && data.booking.hairdresser_rating > 0 && (
                    <div className="flex items-center space-x-1 mt-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-muted-foreground">
                        {data.booking.hairdresser_rating}/5
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {data.booking.hairdresser_phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{data.booking.hairdresser_phone}</span>
                    </div>
                  )}
                  {data.booking.hairdresser_address && (
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span className="text-sm">{data.booking.hairdresser_address}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/hairdressers/${data.booking?.hairdresser_id}`)}
                >
                  Voir le profil complet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Détails du service */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Scissors className="w-5 h-5" />
              <span>Détails du service</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{data.booking.service_name}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Durée :</span>
                  <span>{data.booking.duration_minutes} minutes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Euro className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Prix du service :</span>
                  <span>{data.booking.service_price}€</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Avis associé */}
      {data.review && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="w-5 h-5" />
                <span>Avis laissé</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Note :</span>
                  <div className="flex items-center space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < data.review!.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({data.review.rating}/5)
                  </span>
                </div>
                {data.review.comment && (
                  <div>
                    <span className="font-medium">Commentaire :</span>
                    <p className="mt-2 text-muted-foreground">{data.review.comment}</p>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Avis laissé le {new Date(data.review.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
