'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { fetchAllPaginated } from '@/lib/supabase/pagination'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Scissors, Search, Star, MapPin, Phone, Calendar, Euro, Eye, Mail, MoreVertical, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type HairdresserRow = Database['public']['Tables']['hairdressers']['Row']
type Hairdresser = HairdresserRow & {
  bookings_count?: number
  total_revenue?: number
  email?: string
  is_invisible?: boolean
}

type VisibilityFilter = 'all' | 'visible' | 'hidden'

export default function HairdressersPage() {
  const [hairdressers, setHairdressers] = useState<Hairdresser[]>([])
  const [filteredHairdressers, setFilteredHairdressers] = useState<Hairdresser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    fetchHairdressers()
  }, [])

  useEffect(() => {
    filterHairdressers()
  }, [hairdressers, searchTerm, statusFilter, visibilityFilter])

  // Revenir à la page 1 quand les filtres changent
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, visibilityFilter, pageSize])

  // Sous-ensemble paginé à afficher
  const paginatedHairdressers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredHairdressers.slice(start, start + pageSize)
  }, [filteredHairdressers, currentPage, pageSize])

  const fetchHairdressers = async () => {
    try {
      // 1. Récupérer TOUS les coiffeurs avec pagination (contourne la limite de 1000)
      const hairdressersData = await fetchAllPaginated<HairdresserRow>((from, to) =>
        supabase
          .from('hairdressers')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to)
      )

      if (hairdressersData.length === 0) {
        setHairdressers([])
        return
      }

      const hairdresserIds = hairdressersData.map(h => h.id)
      const userIds = hairdressersData
        .map(h => h.user_id)
        .filter((id): id is string => id !== null)

      // 2. Récupérer TOUTES les réservations de ces coiffeurs en une seule requête paginée
      //    puis agréger côté client (évite N+1 requêtes).
      const bookings = await fetchAllPaginated<{
        hairdresser_id: string | null
        total_price: number
        status: string | null
      }>((from, to) =>
        supabase
          .from('bookings')
          .select('hairdresser_id, total_price, status')
          .in('hairdresser_id', hairdresserIds)
          .range(from, to)
      )

      const statsByHairdresser = new Map<string, { count: number; revenue: number }>()
      for (const booking of bookings) {
        if (!booking.hairdresser_id) continue
        const current = statsByHairdresser.get(booking.hairdresser_id) || { count: 0, revenue: 0 }
        current.count += 1
        if (booking.status === 'completed') {
          current.revenue += booking.total_price || 0
        }
        statsByHairdresser.set(booking.hairdresser_id, current)
      }

      // 3. Récupérer tous les emails correspondants en une seule requête paginée
      const emailRows = userIds.length > 0
        ? await fetchAllPaginated<{ id: string; email: string }>((from, to) =>
            supabase
              .from('users')
              .select('id, email')
              .in('id', userIds)
              .range(from, to)
          )
        : []
      const emailByUserId = new Map(emailRows.map(u => [u.id, u.email]))

      // 4. Récupérer les overrides admin (invisible_hairdressers)
      const invisibilityRows = await fetchAllPaginated<{
        hairdresser_id: string
        is_invisible: boolean
      }>((from, to) =>
        supabase
          .from('invisible_hairdressers')
          .select('hairdresser_id, is_invisible')
          .in('hairdresser_id', hairdresserIds)
          .range(from, to)
      )
      const invisibilityMap = new Map(
        invisibilityRows.map(row => [row.hairdresser_id, row.is_invisible])
      )

      // 5. Assembler les résultats finaux
      const hairdressersWithStats: Hairdresser[] = hairdressersData.map(hairdresser => {
        const stats = statsByHairdresser.get(hairdresser.id) || { count: 0, revenue: 0 }
        return {
          ...hairdresser,
          bookings_count: stats.count,
          total_revenue: stats.revenue,
          email: hairdresser.user_id ? emailByUserId.get(hairdresser.user_id) : undefined,
          is_invisible: invisibilityMap.get(hairdresser.id) || false,
        }
      })

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

    // Filtre par visibilité (basé sur la colonne hairdressers.is_visible calculée
    // automatiquement par recalculate_hairdresser_visibility côté Postgres)
    if (visibilityFilter === 'visible') {
      filtered = filtered.filter(hairdresser => hairdresser.is_visible === true)
    } else if (visibilityFilter === 'hidden') {
      filtered = filtered.filter(hairdresser => hairdresser.is_visible !== true)
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
            <Select
              value={visibilityFilter}
              onValueChange={(value) => setVisibilityFilter(value as VisibilityFilter)}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filtrer par visibilité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les visibilités</SelectItem>
                <SelectItem value="visible">Visibles dans l'app</SelectItem>
                <SelectItem value="hidden">Non visibles</SelectItem>
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
                  <TableHead>Visibilité</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Réservations</TableHead>
                  <TableHead>Revenus</TableHead>
                  <TableHead>Inscription</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedHairdressers.map((hairdresser) => (
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
                    <TableCell>
                      {hairdresser.is_visible ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          Visible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" />
                          {hairdresser.is_invisible ? 'Masqué admin' : 'Non visible'}
                        </Badge>
                      )}
                    </TableCell>
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

          {filteredHairdressers.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredHairdressers.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
