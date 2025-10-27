'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Scissors, Search, Star, MapPin, Phone, Calendar, Euro, Eye } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

type Hairdresser = Database['public']['Tables']['hairdressers']['Row'] & {
  bookings_count?: number
  total_revenue?: number
}

export default function HairdressersPage() {
  const [hairdressers, setHairdressers] = useState<Hairdresser[]>([])
  const [filteredHairdressers, setFilteredHairdressers] = useState<Hairdresser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const supabase = createClient()
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

      // Récupérer les statistiques de réservations pour chaque coiffeur
      const hairdressersWithStats = await Promise.all(
        (hairdressersData || []).map(async (hairdresser) => {
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select('total_price, status')
            .eq('hairdresser_id', hairdresser.id)

          const bookingsCount = bookingsData?.length || 0
          const totalRevenue = bookingsData
            ?.filter(b => b.status === 'completed')
            .reduce((sum, booking) => sum + booking.total_price, 0) || 0

          return {
            ...hairdresser,
            bookings_count: bookingsCount,
            total_revenue: totalRevenue
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
                  placeholder="Rechercher par nom, téléphone ou adresse..."
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
                    <TableCell className="font-medium">
                      {hairdresser.name}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/hairdressers/${hairdresser.id}`)}
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
