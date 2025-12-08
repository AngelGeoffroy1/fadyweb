'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { CreditCard, Search, Calendar, TrendingUp, Users, Settings } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'

type Subscription = Database['public']['Tables']['hairdresser_subscriptions']['Row'] & {
  hairdresser?: {
    name: string
    avatar_url?: string
    email?: string
  }
  commission_percentage?: number
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  // Stats
  const [stats, setStats] = useState({
    total_active: 0,
    total_standard: 0,
    total_boost: 0,
    total_rookie: 0,
    total_ambassador: 0
  })

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  useEffect(() => {
    filterSubscriptions()
    calculateStats()
  }, [subscriptions, searchTerm, statusFilter, typeFilter])

  const fetchSubscriptions = async () => {
    try {
      // Récupérer les abonnements avec les infos des coiffeurs et les commissions
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('hairdresser_subscriptions')
        .select(`
          *,
          hairdressers (
            name,
            avatar_url,
            user_id
          )
        `)
        .order('created_at', { ascending: false })

      if (subscriptionsError) {
        console.error('Erreur Supabase:', subscriptionsError)
        throw subscriptionsError
      }

      // Récupérer les pourcentages de commission
      const { data: feesData } = await supabase
        .from('subscription_fees')
        .select('*')

      const feesMap = new Map(
        (feesData || []).map(fee => [fee.subscription_type, Number(fee.commission_percentage)])
      )

      // Enrichir les données avec les commissions
      const enrichedSubscriptions = (subscriptionsData || []).map(sub => ({
        ...sub,
        hairdresser: Array.isArray(sub.hairdressers)
          ? sub.hairdressers[0]
          : sub.hairdressers,
        commission_percentage: feesMap.get(sub.subscription_type)
      }))

      setSubscriptions(enrichedSubscriptions)
    } catch (error) {
      console.error('Erreur lors du chargement des abonnements:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterSubscriptions = () => {
    let filtered = subscriptions

    // Filtre par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(sub =>
        sub.hairdresser?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.stripe_subscription_id?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sub => sub.status === statusFilter)
    }

    // Filtre par type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(sub => sub.subscription_type === typeFilter)
    }

    setFilteredSubscriptions(filtered)
  }

  const calculateStats = () => {
    const active = subscriptions.filter(s => s.status === 'active').length
    const standard = subscriptions.filter(s => s.subscription_type === 'standard').length
    const boost = subscriptions.filter(s => s.subscription_type === 'boost').length
    const rookie = subscriptions.filter(s => s.subscription_type === 'rookie').length
    const ambassador = subscriptions.filter(s => s.subscription_type === 'ambassador').length

    setStats({
      total_active: active,
      total_standard: standard,
      total_boost: boost,
      total_rookie: rookie,
      total_ambassador: ambassador
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Actif</Badge>
      case 'incomplete':
        return <Badge className="bg-yellow-100 text-yellow-800">Incomplet</Badge>
      case 'canceled':
        return <Badge className="bg-red-100 text-red-800">Annulé</Badge>
      case 'past_due':
        return <Badge className="bg-orange-100 text-orange-800">En retard</Badge>
      case 'trialing':
        return <Badge className="bg-blue-100 text-blue-800">Essai</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'standard':
        return <Badge variant="default">Standard</Badge>
      case 'boost':
        return <Badge className="bg-purple-100 text-purple-800">Boost</Badge>
      case 'rookie':
        return <Badge className="bg-blue-100 text-blue-800">Rookie</Badge>
      case 'ambassador':
        return <Badge className="bg-yellow-100 text-yellow-800">Ambassadeur</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Abonnements</h1>
          <p className="text-muted-foreground">Gestion des abonnements des coiffeurs</p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/subscriptions/fees')}
          className="flex items-center space-x-2"
        >
          <Settings className="w-4 h-4" />
          <span>Gérer les commissions</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Abonnements actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.total_active}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Standard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats.total_standard}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Boost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-purple-500" />
              <span className="text-2xl font-bold">{stats.total_boost}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rookie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-cyan-500" />
              <span className="text-2xl font-bold">{stats.total_rookie}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ambassadeur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold">{stats.total_ambassador}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Rechercher par nom de coiffeur ou ID Stripe..."
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
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="incomplete">Incomplet</SelectItem>
                <SelectItem value="canceled">Annulé</SelectItem>
                <SelectItem value="past_due">En retard</SelectItem>
                <SelectItem value="trialing">Essai</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="boost">Boost</SelectItem>
                <SelectItem value="rookie">Rookie</SelectItem>
                <SelectItem value="ambassador">Ambassadeur</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Abonnements ({filteredSubscriptions.length})</span>
          </CardTitle>
          <CardDescription>
            Liste des abonnements actifs et historiques
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coiffeur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Annulation</TableHead>
                  <TableHead>Stripe ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((subscription) => (
                  <motion.tr
                    key={subscription.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell className="font-medium">
                      {subscription.hairdresser?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {getTypeBadge(subscription.subscription_type)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(subscription.status)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {subscription.commission_percentage !== undefined
                          ? `${subscription.commission_percentage}%`
                          : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {subscription.current_period_start ? (
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{new Date(subscription.current_period_start).toLocaleDateString('fr-FR')}</span>
                        </div>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {subscription.current_period_end ? (
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}</span>
                        </div>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {subscription.cancel_at_period_end ? (
                        <Badge className="bg-orange-100 text-orange-800">Oui</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">Non</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {subscription.stripe_subscription_id || 'N/A'}
                      </span>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredSubscriptions.length === 0 && (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun abonnement trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
