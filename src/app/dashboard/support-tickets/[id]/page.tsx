'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { ArrowLeft, MessageSquare, User, Calendar, Mail, Phone, MapPin, CreditCard, Scissors, CheckCircle, XCircle, RefreshCcw } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { toast } from 'sonner'
import { RefundDialog } from '@/components/refund-dialog'

type SupportTicket = Database['public']['Tables']['support_tickets']['Row'] & {
  bookings?: {
    id: string
    booking_date: string
    booking_time: string
    total_price: number
    location_type: string
    address: string | null
    status: string
    payment_method: string
    hairdressers?: {
      id: string
      name: string
      phone: string | null
      address: string
    } | null
    hairdresser_services?: {
      service_name: string
      duration_minutes: number
      price: number | null
    } | null
  } | null
  hairdresser_subscription?: {
    subscription_type: string
  } | null
  subscription_fee?: {
    commission_percentage: number
  } | null
}

export default function SupportTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminResponse, setAdminResponse] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetails()
    }
  }, [ticketId])

  const fetchTicketDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          bookings:booking_id (
            id,
            booking_date,
            booking_time,
            total_price,
            location_type,
            address,
            status,
            payment_method,
            hairdressers:hairdresser_id (
              id,
              name,
              phone,
              address
            ),
            hairdresser_services:service_id (
              service_name,
              duration_minutes,
              price
            )
          )
        `)
        .eq('id', ticketId)
        .single()

      if (error) throw error

      // Récupérer la subscription du coiffeur si une réservation existe
      let enrichedData = data
      if (data.bookings?.hairdressers?.id) {
        const { data: subscriptionData } = await supabase
          .from('hairdresser_subscriptions')
          .select(`
            subscription_type
          `)
          .eq('hairdresser_id', data.bookings.hairdressers.id)
          .single()

        if (subscriptionData) {
          // Récupérer les frais de commission pour ce type de subscription
          const { data: feeData } = await supabase
            .from('subscription_fees')
            .select(`
              commission_percentage
            `)
            .eq('subscription_type', subscriptionData.subscription_type)
            .single()

          enrichedData = {
            ...data,
            hairdresser_subscription: subscriptionData,
            subscription_fee: feeData
          }
        }
      }

      setTicket(enrichedData)
      setAdminResponse(enrichedData.admin_response || '')
      setSelectedStatus(enrichedData.status)
    } catch (error) {
      console.error('Erreur lors du chargement du ticket:', error)
      toast.error('Impossible de charger le ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTicket = async () => {
    if (!ticket) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          admin_response: adminResponse,
          status: selectedStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)

      if (error) throw error

      toast.success('Ticket mis à jour avec succès')
      await fetchTicketDetails()
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      toast.error('Erreur lors de la mise à jour du ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'open':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Ouvert'
      case 'in_progress': return 'En cours'
      case 'resolved': return 'Résolu'
      case 'closed': return 'Fermé'
      default: return status
    }
  }

  const getPaymentMethodLabel = (paymentMethod: string) => {
    switch (paymentMethod) {
      case 'card': return 'Carte Bancaire'
      case 'cash': return 'Cash'
      default: return 'N/A'
    }
  }

  const calculatePricing = () => {
    if (!ticket?.bookings) return null

    const totalPrice = ticket.bookings.total_price
    const commissionPercentage = ticket.subscription_fee?.commission_percentage || 0
    const commission = (totalPrice * commissionPercentage) / 100
    const netPayout = totalPrice - commission

    return {
      totalPrice,
      commissionPercentage,
      commission,
      netPayout
    }
  }

  const handleRefundSuccess = () => {
    toast.success('Remboursement effectué avec succès')
    fetchTicketDetails() // Rafraîchir les données
  }

  const canRefund = () => {
    if (!ticket?.bookings) return false
    return (
      ticket.bookings.payment_method === 'card' &&
      ticket.bookings.status !== 'refund' &&
      ticket.bookings.status !== 'cancelled'
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-muted rounded animate-pulse" />
          <div className="h-96 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Ticket non trouvé</h2>
        <Button onClick={() => router.push('/dashboard/support-tickets')}>
          Retour à la liste
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Détails du Ticket</h1>
            <p className="text-muted-foreground">
              Créé le {new Date(ticket.created_at || '').toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        <Badge className={getStatusColor(ticket.status)}>
          {getStatusLabel(ticket.status)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche - Informations du ticket */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations de contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Informations de contact</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{ticket.email}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{ticket.phone}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Détails du ticket */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>Détails du ticket</span>
                </CardTitle>
                <CardDescription>
                  Catégorie: <Badge variant="outline">{ticket.category}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Message du client:</p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="whitespace-pre-wrap">{ticket.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Informations de la réservation */}
          {ticket.bookings && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>Réservation associée</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start space-x-3">
                      <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Date et heure</p>
                        <p className="font-medium">
                          {new Date(ticket.bookings.booking_date).toLocaleDateString('fr-FR')} à {ticket.bookings.booking_time}
                        </p>
                      </div>
                    </div>

                    {ticket.bookings.hairdressers && (
                      <div className="flex items-start space-x-3">
                        <Scissors className="w-5 h-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Coiffeur</p>
                          <p className="font-medium">{ticket.bookings.hairdressers.name}</p>
                          {ticket.bookings.hairdressers.phone && (
                            <p className="text-sm text-muted-foreground">{ticket.bookings.hairdressers.phone}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {ticket.bookings.hairdresser_services && (
                      <div className="flex items-start space-x-3">
                        <Scissors className="w-5 h-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Service</p>
                          <p className="font-medium">{ticket.bookings.hairdresser_services.service_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {ticket.bookings.hairdresser_services.duration_minutes} minutes
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start space-x-3">
                      <CreditCard className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Moyen de paiement</p>
                        <Badge variant="outline">
                          {getPaymentMethodLabel(ticket.bookings.payment_method)}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <CreditCard className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Prix total</p>
                        <p className="font-medium">{ticket.bookings.total_price} €</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Lieu</p>
                        <p className="font-medium">
                          {ticket.bookings.location_type === 'home' ? 'À domicile' : 'Salon'}
                        </p>
                        {ticket.bookings.address && (
                          <p className="text-sm text-muted-foreground">{ticket.bookings.address}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Statut réservation</p>
                        <Badge variant="outline">{ticket.bookings.status}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Détails financiers */}
          {ticket.bookings && calculatePricing() && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="w-5 h-5" />
                    <span>Détails financiers</span>
                  </CardTitle>
                  <CardDescription>
                    Répartition des montants et commission Fady
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Prix total de la réservation</span>
                      <span className="font-semibold text-lg">{calculatePricing()?.totalPrice.toFixed(2)} €</span>
                    </div>

                    <div className="flex justify-between items-center py-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Commission Fady</p>
                        {ticket.hairdresser_subscription && (
                          <p className="text-xs text-muted-foreground">
                            Abonnement: <Badge variant="outline" className="text-xs">{ticket.hairdresser_subscription.subscription_type}</Badge>
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-600">
                          - {calculatePricing()?.commission.toFixed(2)} €
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ({calculatePricing()?.commissionPercentage}%)
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-3 border-t-2 bg-green-50 dark:bg-green-950 px-3 rounded-lg">
                      <span className="font-semibold">Payout net pour le coiffeur</span>
                      <span className="font-bold text-xl text-green-600">
                        {calculatePricing()?.netPayout.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  {!ticket.subscription_fee && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        ⚠️ Aucune commission configurée pour ce type d'abonnement
                      </p>
                    </div>
                  )}

                  {/* Badge si remboursé */}
                  {ticket.bookings.status === 'refund' && (
                    <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <RefreshCcw className="w-5 h-5 text-orange-600" />
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                          Cette réservation a été remboursée
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                        Remboursé
                      </Badge>
                    </div>
                  )}

                  {/* Bouton de remboursement */}
                  {canRefund() && (
                    <div className="mt-6 pt-4 border-t">
                      <Button
                        onClick={() => setRefundDialogOpen(true)}
                        variant="destructive"
                        className="w-full"
                      >
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Rembourser le paiement
                      </Button>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Cette action créera un remboursement via Stripe Connect
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Colonne droite - Réponse admin */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Gestion du ticket</CardTitle>
                <CardDescription>
                  Répondez au client et mettez à jour le statut
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Changement de statut */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Statut</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Ouvert</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="resolved">Résolu</SelectItem>
                      <SelectItem value="closed">Fermé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Réponse admin */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Réponse</label>
                  <Textarea
                    placeholder="Écrivez votre réponse au client..."
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    rows={8}
                    className="resize-none"
                  />
                </div>

                {/* Bouton de soumission */}
                <Button
                  onClick={handleUpdateTicket}
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? 'Mise à jour...' : 'Mettre à jour le ticket'}
                </Button>

                {/* Informations de mise à jour */}
                {ticket.updated_at && (
                  <div className="text-xs text-muted-foreground pt-4 border-t">
                    Dernière mise à jour: {new Date(ticket.updated_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Modal de remboursement */}
      {ticket?.bookings && calculatePricing() && (
        <RefundDialog
          open={refundDialogOpen}
          onOpenChange={setRefundDialogOpen}
          bookingId={ticket.bookings.id}
          totalAmount={calculatePricing()!.totalPrice}
          commission={calculatePricing()!.commission}
          commissionPercentage={calculatePricing()!.commissionPercentage}
          onRefundSuccess={handleRefundSuccess}
        />
      )}
    </div>
  )
}
