'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { motion } from 'framer-motion'
import { Calendar, Search, Mail, Phone, Clock, Euro, MapPin, Eye } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'

type Booking = Database['public']['Tables']['bookings']['Row'] & {
  user_name?: string
  user_email?: string
  user_phone?: string
  hairdresser_name?: string
  hairdresser_phone?: string
  hairdresser_address?: string
  service_name?: string
  duration_minutes?: number
  service_price?: number
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    fetchBookings()
  }, [])

  useEffect(() => {
    filterBookings()
  }, [bookings, searchTerm, statusFilter])

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          users:user_id(full_name, email, phone),
          hairdressers:hairdresser_id(name, phone, address),
          hairdresser_services:service_id(service_name, duration_minutes, price)
        `)
        .order('booking_date', { ascending: false })

      if (error) throw error

      const transformedBookings: Booking[] = (data || []).map(booking => ({
        ...booking,
        user_name: booking.users?.full_name || 'N/A',
        user_email: booking.users?.email || 'N/A',
        user_phone: booking.users?.phone || null,
        hairdresser_name: booking.hairdressers?.name || 'Coiffeur inconnu',
        hairdresser_phone: booking.hairdressers?.phone || null,
        hairdresser_address: booking.hairdressers?.address || null,
        service_name: booking.hairdresser_services?.service_name || 'Service inconnu',
        duration_minutes: booking.hairdresser_services?.duration_minutes || 0,
        service_price: booking.hairdresser_services?.price || 0
      }))

      setBookings(transformedBookings)
    } catch (error) {
      console.error('Erreur lors du chargement des réservations:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterBookings = () => {
    let filtered = bookings

    if (searchTerm) {
      filtered = filtered.filter(booking =>
        booking.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.hairdresser_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(booking => booking.status === statusFilter)
    }

    setFilteredBookings(filtered)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Réservations</h1>
        <p className="text-muted-foreground">Liste de toutes les réservations de la plateforme</p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Rechercher par nom client, email ou coiffeur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                  <SelectItem value="past">Passé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Réservations ({filteredBookings.length})</span>
          </CardTitle>
          <CardDescription>
            Liste des réservations avec toutes les informations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Heure</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Coiffeur</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Lieu</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking) => (
                  <motion.tr
                    key={booking.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{new Date(booking.booking_date).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{booking.booking_time}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{booking.user_name}</div>
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span>{booking.user_email}</span>
                        </div>
                        {booking.user_phone && (
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{booking.user_phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{booking.hairdresser_name}</div>
                        {booking.hairdresser_phone && (
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{booking.hairdresser_phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{booking.service_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {booking.duration_minutes} min
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <Badge variant="outline">
                          {booking.location_type === 'home' ? 'À domicile' : 'En salon'}
                        </Badge>
                      </div>
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
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Voir</span>
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredBookings.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune réservation trouvée</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
