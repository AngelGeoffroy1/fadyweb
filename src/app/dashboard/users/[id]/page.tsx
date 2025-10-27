'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Star, 
  MessageCircle, 
  Bell,
  Smartphone,
  ArrowLeft,
  Euro,
  MapPin,
  Clock,
  Check,
  X
} from 'lucide-react'
import { Database } from '@/lib/supabase/types'

// Fonction pour générer les paramètres statiques

type User = Database['public']['Tables']['users']['Row']
type Booking = Database['public']['Tables']['bookings']['Row'] & {
  hairdresser_name?: string
  service_name?: string
}
type Review = Database['public']['Tables']['reviews']['Row'] & {
  hairdresser_name?: string
}
type Conversation = Database['public']['Tables']['conversations']['Row'] & {
  hairdresser_name?: string
}
type Message = Database['public']['Tables']['messages']['Row']
type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row']
type DeviceToken = Database['public']['Tables']['user_device_tokens']['Row']
type FadyProToken = Database['public']['Tables']['fady_pro_device_tokens']['Row']

interface UserDetails {
  user: User | null
  bookings: Booking[]
  reviews: Review[]
  conversations: Conversation[]
  messages: Message[]
  notificationPreferences: NotificationPreferences | null
  deviceTokens: DeviceToken[]
  fadyProTokens: FadyProToken[]
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const [data, setData] = useState<UserDetails>({
    user: null,
    bookings: [],
    reviews: [],
    conversations: [],
    messages: [],
    notificationPreferences: null,
    deviceTokens: [],
    fadyProTokens: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (userId) {
      fetchUserDetails()
    }
  }, [userId])

  const fetchUserDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Récupérer les informations de l'utilisateur
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) throw userError
      if (!user) throw new Error('Utilisateur non trouvé')

      // Récupérer les réservations avec les noms des coiffeurs et services
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          hairdressers:hairdresser_id(name),
          hairdresser_services:service_id(service_name)
        `)
        .eq('user_id', userId)
        .order('booking_date', { ascending: false })

      if (bookingsError) throw bookingsError

      const transformedBookings: Booking[] = (bookings || []).map(booking => ({
        ...booking,
        hairdresser_name: booking.hairdressers?.name || 'Coiffeur inconnu',
        service_name: booking.hairdresser_services?.service_name || 'Service inconnu'
      }))

      // Récupérer les avis avec les noms des coiffeurs
      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          hairdressers:hairdresser_id(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (reviewsError) throw reviewsError

      const transformedReviews: Review[] = (reviews || []).map(review => ({
        ...review,
        hairdresser_name: review.hairdressers?.name || 'Coiffeur inconnu'
      }))

      // Récupérer les conversations
      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .select(`
          *,
          hairdressers:hairdresser_id(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (conversationsError) throw conversationsError

      const transformedConversations: Conversation[] = (conversations || []).map(conversation => ({
        ...conversation,
        hairdresser_name: conversation.hairdressers?.name || 'Coiffeur inconnu'
      }))

      // Récupérer les messages (limité aux 50 derniers)
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (messagesError) throw messagesError

      // Récupérer les préférences de notification
      const { data: notificationPreferences, error: prefsError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (prefsError && prefsError.code !== 'PGRST116') throw prefsError

      // Récupérer les tokens d'appareil
      const { data: deviceTokens, error: tokensError } = await supabase
        .from('user_device_tokens')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (tokensError) throw tokensError

      // Récupérer les tokens Fady Pro
      const { data: fadyProTokens, error: fadyProError } = await supabase
        .from('fady_pro_device_tokens')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fadyProError) throw fadyProError

      setData({
        user,
        bookings: transformedBookings,
        reviews: transformedReviews,
        conversations: transformedConversations,
        messages: messages || [],
        notificationPreferences: notificationPreferences || null,
        deviceTokens: deviceTokens || [],
        fadyProTokens: fadyProTokens || []
      })

    } catch (error) {
      console.error('Erreur lors du chargement des détails de l\'utilisateur:', error)
      setError(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
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
              <Button onClick={() => router.push('/dashboard/users')}>
                Retour à la liste des utilisateurs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data.user) {
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
          <h1 className="text-3xl font-bold text-foreground">Utilisateur non trouvé</h1>
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
          <h1 className="text-3xl font-bold text-foreground">{data.user.full_name || data.user.email}</h1>
          <p className="text-muted-foreground">Détails du profil utilisateur</p>
        </div>
      </div>

      {/* En-tête du profil */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start space-x-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {data.user.avatar_url ? (
                  <img
                    src={data.user.avatar_url}
                    alt={data.user.full_name || data.user.email}
                    className="h-24 w-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Informations principales */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center space-x-4">
                  <h2 className="text-2xl font-bold">{data.user.full_name || 'Utilisateur'}</h2>
                  {data.user.email_confirmed ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Email confirmé
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Email non confirmé</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{data.user.email}</span>
                  </div>
                  
                  {data.user.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{data.user.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      Inscrit le {new Date(data.user.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Réservations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
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
                      <TableHead>Coiffeur</TableHead>
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
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span>{booking.booking_time}</span>
                          </div>
                        </TableCell>
                        <TableCell>{booking.hairdresser_name}</TableCell>
                        <TableCell>{booking.service_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {booking.location_type === 'home' ? 'À domicile' : 'En salon'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(booking.status || 'pending')}>
                            {getStatusBadge(booking.status || 'pending')}
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

      {/* Avis laissés */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="w-5 h-5" />
              <span>Avis laissés ({data.reviews.length})</span>
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
                        <span className="font-medium">{review.hairdresser_name}</span>
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
              <p className="text-muted-foreground text-center py-4">Aucun avis laissé</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Conversations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
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
                      <span className="font-medium">{conversation.hairdresser_name}</span>
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

      {/* Messages */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" />
              <span>Messages envoyés ({data.messages.length})</span>
            </CardTitle>
            <CardDescription>50 derniers messages</CardDescription>
          </CardHeader>
          <CardContent>
            {data.messages.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.messages.map((message) => (
                  <div key={message.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={message.is_read ? "secondary" : "default"}>
                          {message.is_read ? 'Lu' : 'Non lu'}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {message.created_at && new Date(message.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucun message envoyé</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Préférences de notification */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="w-5 h-5" />
              <span>Préférences de notification</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.notificationPreferences ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span>Rappels de réservation</span>
                  {data.notificationPreferences.booking_reminders ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <X className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>Confirmations de réservation</span>
                  {data.notificationPreferences.booking_confirmations ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <X className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>Nouveaux messages</span>
                  {data.notificationPreferences.new_messages ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <X className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>Coiffeurs à proximité</span>
                  {data.notificationPreferences.nearby_hairdressers ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <X className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucune préférence configurée</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Tokens d'appareil */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Smartphone className="w-5 h-5" />
              <span>Appareils enregistrés ({data.deviceTokens.length + data.fadyProTokens.length})</span>
            </CardTitle>
            <CardDescription>Tokens d'appareils pour les notifications push</CardDescription>
          </CardHeader>
          <CardContent>
            {(data.deviceTokens.length > 0 || data.fadyProTokens.length > 0) ? (
              <div className="space-y-4">
                {data.deviceTokens.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Applications standard</h4>
                    <div className="space-y-2">
                      {data.deviceTokens.map((token) => (
                        <div key={token.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge variant="outline">{token.platform}</Badge>
                              <p className="text-sm text-muted-foreground mt-1">
                                {token.device_token.substring(0, 30)}...
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Créé le {new Date(token.created_at || '').toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {data.fadyProTokens.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Fady Pro</h4>
                    <div className="space-y-2">
                      {data.fadyProTokens.map((token) => (
                        <div key={token.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge variant="outline">{token.platform}</Badge>
                              <p className="text-sm text-muted-foreground mt-1">
                                {token.device_token.substring(0, 30)}...
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Créé le {new Date(token.created_at || '').toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucun appareil enregistré</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
