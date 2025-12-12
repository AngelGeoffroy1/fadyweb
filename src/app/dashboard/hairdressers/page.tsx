'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Scissors, Search, Star, MapPin, Phone, Calendar, Euro, Eye, Mail, MoreVertical, EyeOff } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Hairdresser = Database['public']['Tables']['hairdressers']['Row'] & {
  bookings_count?: number
  total_revenue?: number
  email?: string
  is_invisible?: boolean
}

export default function HairdressersPage() {
  const [hairdressers, setHairdressers] = useState<Hairdresser[]>([])
  const [filteredHairdressers, setFilteredHairdressers] = useState<Hairdresser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    fetchHairdressers()
  }, [])

  useEffect(() => {
    filterHairdressers()
  }, [hairdressers, searchTerm, statusFilter])

  const fetchHairdressers = async () => {
    try {
      // Récupérer les coiffeurs avec leurs statistiques
      const { data: hairdressersData, error: hairdressersError } = await supabase
        .from('hairdressers')
        .select('*')
        .order('created_at', { ascending: false })

      if (hairdressersError) throw hairdressersError

      // Récupérer les statistiques de réservations et email pour chaque coiffeur
      const hairdressersWithStats = await Promise.all(
        (hairdressersData || []).map(async (hairdresser) => {
          // Récupérer les statistiques de réservations
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select('total_price, status')
            .eq('hairdresser_id', hairdresser.id)

          const bookingsCount = bookingsData?.length || 0
          const totalRevenue = bookingsData
            ?.filter(b => b.status === 'completed')
            .reduce((sum, booking) => sum + booking.total_price, 0) || 0

          // Récupérer l'email de l'utilisateur associé
          let email = undefined
          if (hairdresser.user_id) {
            const { data: userData } = await supabase
              .from('users')
              .select('email')
              .eq('id', hairdresser.user_id)
              .single()

            email = userData?.email
          }

          // Récupérer le statut de visibilité
          const { data: invisibilityData } = await supabase
            .from('invisible_hairdressers')
            .select('is_invisible')
            .eq('hairdresser_id', hairdresser.id)
            .maybeSingle()

          return {
            ...hairdresser,
            bookings_count: bookingsCount,
            total_revenue: totalRevenue,
            email,
            is_invisible: invisibilityData?.is_invisible || false
          }
        })
      )

      setHairdressers(hairdressersWithStats)
    } catch (error) {
      console.error('Erreur lors du chargement des coiffeurs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterHairdressers = () => {
    let filtered = hairdressers

    // Filtre par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(hairdresser =>
        hairdresser.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hairdresser.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hairdresser.phone?.includes(searchTerm) ||
        hairdresser.address.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(hairdresser => hairdresser.statut === statusFilter)
    }

    setFilteredHairdressers(filtered)
  }

  const toggleHairdresserVisibility = async (hairdresserId: string, currentVisibility: boolean) => {
    try {
      const newVisibility = !currentVisibility

      // Vérifier si une entrée existe déjà
      const { data: existingEntry } = await supabase
        .from('invisible_hairdressers')
        .select('id')
        .eq('hairdresser_id', hairdresserId)
        .maybeSingle()

      if (existingEntry) {
        // Mettre à jour l'entrée existante
        const { error } = await supabase
          .from('invisible_hairdressers')
          .update({ is_invisible: newVisibility })
          .eq('hairdresser_id', hairdresserId)

        if (error) throw error
      } else {
        // Créer une nouvelle entrée
        const { error } = await supabase
          .from('invisible_hairdressers')
          .insert({ hairdresser_id: hairdresserId, is_invisible: true })

        if (error) throw error
      }

      // Si le coiffeur devient invisible, envoyer un email de notification
      if (newVisibility) {
        // Récupérer les informations du coiffeur pour l'email
        const hairdresser = hairdressers.find(h => h.id === hairdresserId)

        console.log('🔍 Coiffeur à rendre invisible:', {
          id: hairdresserId,
          name: hairdresser?.name,
          email: hairdresser?.email
        })

        if (hairdresser?.email && hairdresser?.name) {
          try {
            console.log('📧 Envoi de l\'email de suspension...')

            const payload = {
              email: hairdresser.email,
              name: hairdresser.name,
              hairdresserId: hairdresserId,
            }

            console.log('📤 Payload:', payload)

            const response = await fetch(
              'https://sfxmdvdzqasvzujwbbfg.supabase.co/functions/v1/send-hairdresser-suspension-email',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              }
            )

            console.log('📥 Response status:', response.status)

            if (!response.ok) {
              const errorData = await response.json()
              console.error('❌ Erreur lors de l\'envoi de l\'email:', errorData)
            } else {
              const successData = await response.json()
              console.log('✅ Email de suspension envoyé avec succès:', successData)
            }
          } catch (emailError) {
            console.error('💥 Erreur lors de l\'envoi de l\'email:', emailError)
            // On continue même si l'email échoue
          }
        } else {
          console.warn('⚠️ Email ou nom manquant pour le coiffeur', {
            email: hairdresser?.email,
            name: hairdresser?.name
          })
        }
      }

      // Rafraîchir la liste des coiffeurs
      await fetchHairdressers()
    } catch (error) {
      console.error('Erreur lors de la modification de la visibilité:', error)
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
        <h1 className="text-3xl font-bold text-foreground">Coiffeurs</h1>
        <p className="text-muted-foreground">Liste des coiffeurs de la plateforme</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Rechercher par nom, email, téléphone ou adresse..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="Diplomé">Diplômés</SelectItem>
                <SelectItem value="Amateur">Amateurs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Hairdressers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Scissors className="w-5 h-5" />
            <span>Coiffeurs ({filteredHairdressers.length})</span>
          </CardTitle>
          <CardDescription>
            Liste des coiffeurs inscrits sur la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Réservations</TableHead>
                  <TableHead>Revenus</TableHead>
                  <TableHead>Inscription</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHairdressers.map((hairdresser) => (
                  <motion.tr
                    key={hairdresser.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell className={`font-medium ${hairdresser.is_invisible ? 'text-red-600' : ''}`}>
                      {hairdresser.name}
                    </TableCell>
                    <TableCell>
                      {hairdresser.email ? (
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{hairdresser.email}</span>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {hairdresser.phone ? (
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{hairdresser.phone}</span>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2 max-w-xs">
                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{hairdresser.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(hairdresser.statut)}</TableCell>
                    <TableCell>{getRatingStars(hairdresser.rating)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{hairdresser.bookings_count || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Euro className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{(hairdresser.total_revenue || 0).toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{new Date(hairdresser.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/hairdressers/${hairdresser.id}`)}
                            className="cursor-pointer"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Voir
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleHairdresserVisibility(hairdresser.id, hairdresser.is_invisible || false)}
                            className="cursor-pointer"
                          >
                            {hairdresser.is_invisible ? (
                              <>
                                <Eye className="w-4 h-4 mr-2" />
                                Rendre visible
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-4 h-4 mr-2" />
                                Rendre invisible
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredHairdressers.length === 0 && (
            <div className="text-center py-8">
              <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun coiffeur trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
