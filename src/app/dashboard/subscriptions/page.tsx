'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { fetchAllPaginated } from '@/lib/supabase/pagination'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Pagination } from '@/components/ui/pagination'
import { Checkbox } from '@/components/ui/checkbox'
import { motion } from 'framer-motion'
import { CreditCard, Search, Calendar, TrendingUp, Users, Settings, Gift, UserPlus, Trash2 } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

type Subscription = Database['public']['Tables']['hairdresser_subscriptions']['Row'] & {
  hairdresser?: {
    name: string
    avatar_url?: string
    email?: string
  }
  commission_percentage?: number
  // Propriétés additionnelles non encore dans les types générés
  is_gifted?: boolean | null
  gifted_by_admin_id?: string | null
  gifted_reason?: string | null
  apple_transaction_id?: string | null
  apple_original_transaction_id?: string | null
  expires_date?: string | null
}

type Hairdresser = {
  id: string
  name: string
  avatar_url?: string
  phone?: string
  user_id?: string
  users?: {
    email?: string
  }
  activeSubscription?: {
    subscription_type: string
    status: string
  } | null
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { toast } = useToast()

  // States pour la modal d'assignation
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [searchHairdresser, setSearchHairdresser] = useState('')
  const [hairdressers, setHairdressers] = useState<Hairdresser[]>([])
  const [selectedHairdresser, setSelectedHairdresser] = useState<Hairdresser | null>(null)
  const [selectedSubscriptionType, setSelectedSubscriptionType] = useState<string>('standard')
  const [endDate, setEndDate] = useState<string>('')
  const [isIndefinite, setIsIndefinite] = useState(false)
  const [giftedReason, setGiftedReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // States pour la suppression d'abonnement offert
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<Subscription | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // Revenir à la page 1 quand les filtres changent
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, typeFilter, pageSize])

  // Sous-ensemble paginé à afficher
  const paginatedSubscriptions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredSubscriptions.slice(start, start + pageSize)
  }, [filteredSubscriptions, currentPage, pageSize])

  useEffect(() => {
    if (searchHairdresser.length >= 2) {
      searchHairdressers()
    } else {
      setHairdressers([])
    }
  }, [searchHairdresser])

  const fetchSubscriptions = async () => {
    try {
      // Récupérer TOUS les abonnements avec pagination (contourne la limite de 1000)
      type RawSubscriptionRow = Subscription & {
        hairdressers:
          | { name: string; avatar_url: string | null; user_id: string | null }
          | { name: string; avatar_url: string | null; user_id: string | null }[]
          | null
      }

      const subscriptionsData = await fetchAllPaginated<RawSubscriptionRow>((from, to) =>
        supabase
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
          .range(from, to)
      )

      // Récupérer les pourcentages de commission
      const { data: feesData } = await supabase
        .from('subscription_fees')
        .select('*')

      const feesMap = new Map(
        (feesData || []).map(fee => [fee.subscription_type, Number(fee.commission_percentage)])
      )

      // Enrichir les données avec les commissions
      const enrichedSubscriptions: Subscription[] = subscriptionsData.map(sub => {
        const rawHairdresser = Array.isArray(sub.hairdressers)
          ? sub.hairdressers[0]
          : sub.hairdressers
        return {
          ...sub,
          hairdresser: rawHairdresser
            ? {
                name: rawHairdresser.name,
                avatar_url: rawHairdresser.avatar_url ?? undefined,
              }
            : undefined,
          commission_percentage: feesMap.get(sub.subscription_type),
        }
      })

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

  const searchHairdressers = async () => {
    try {
      const { data, error } = await supabase
        .from('hairdressers')
        .select(`
          id,
          name,
          avatar_url,
          phone,
          user_id
        `)
        .ilike('name', `%${searchHairdresser}%`)
        .limit(10)

      if (error) throw error

      // Récupérer les emails et abonnements actifs des coiffeurs
      const enrichedData = await Promise.all((data || []).map(async (hairdresser) => {
        let enriched: Hairdresser = { ...hairdresser }

        // Récupérer l'email
        if (hairdresser.user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', hairdresser.user_id)
            .single()

          if (userData) {
            enriched.users = { email: userData.email }
          }
        }

        // Récupérer l'abonnement actif
        const { data: subscriptionData } = await supabase
          .from('hairdresser_subscriptions')
          .select('subscription_type, status')
          .eq('hairdresser_id', hairdresser.id)
          .eq('status', 'active')
          .maybeSingle()

        enriched.activeSubscription = subscriptionData || null

        return enriched
      }))

      setHairdressers(enrichedData)
    } catch (error) {
      console.error('Erreur lors de la recherche de coiffeurs:', error)
    }
  }

  const handleAssignSubscription = async () => {
    if (!selectedHairdresser) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un coiffeur',
        variant: 'destructive',
      })
      return
    }

    if (!isIndefinite && !endDate) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une date de fin ou cocher "Indéfiniment"',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Récupérer l'ID de l'admin connecté
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté')

      const { data: adminData } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!adminData) throw new Error('Admin non trouvé')

      // Vérifier si le coiffeur a déjà un abonnement actif
      const { data: existingSubscription } = await supabase
        .from('hairdresser_subscriptions')
        .select('id')
        .eq('hairdresser_id', selectedHairdresser.id)
        .eq('status', 'active')
        .maybeSingle()

      if (existingSubscription) {
        toast({
          title: 'Erreur',
          description: 'Ce coiffeur a déjà un abonnement actif',
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }

      // Créer l'abonnement offert
      const { error: subscriptionError } = await supabase
        .from('hairdresser_subscriptions')
        .insert({
          hairdresser_id: selectedHairdresser.id,
          subscription_type: selectedSubscriptionType,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: isIndefinite ? null : new Date(endDate).toISOString(),
          is_gifted: true,
          gifted_by_admin_id: adminData.id,
          gifted_reason: giftedReason || 'Abonnement offert par l\'admin',
        })

      if (subscriptionError) throw subscriptionError

      toast({
        title: 'Succès',
        description: 'Abonnement assigné avec succès',
      })

      // Réinitialiser le formulaire
      setIsAssignDialogOpen(false)
      setSelectedHairdresser(null)
      setSelectedSubscriptionType('standard')
      setEndDate('')
      setIsIndefinite(false)
      setGiftedReason('')
      setSearchHairdresser('')

      // Recharger la liste
      fetchSubscriptions()
    } catch (error) {
      console.error('Erreur lors de l\'assignation de l\'abonnement:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible d\'assigner l\'abonnement',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteGiftedSubscription = async () => {
    if (!subscriptionToDelete) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('hairdresser_subscriptions')
        .delete()
        .eq('id', subscriptionToDelete.id)

      if (error) throw error

      toast({
        title: 'Succès',
        description: `L'abonnement offert de ${subscriptionToDelete.hairdresser?.name || 'ce coiffeur'} a été supprimé`,
      })

      // Fermer la modal et recharger la liste
      setIsDeleteDialogOpen(false)
      setSubscriptionToDelete(null)
      fetchSubscriptions()
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'abonnement:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'abonnement',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
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
        <div className="flex items-center space-x-2">
          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="flex items-center space-x-2">
                <Gift className="w-4 h-4" />
                <span>Assigner un abonnement</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Assigner un abonnement</DialogTitle>
                <DialogDescription>
                  Assignez un abonnement gratuit à un coiffeur
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Recherche de coiffeur */}
                <div className="space-y-2">
                  <Label htmlFor="search-hairdresser">Rechercher un coiffeur</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="search-hairdresser"
                      placeholder="Nom du coiffeur..."
                      value={searchHairdresser}
                      onChange={(e) => setSearchHairdresser(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Résultats de recherche */}
                {hairdressers.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {hairdressers.map((hairdresser) => {
                      const hasActiveSubscription = !!hairdresser.activeSubscription
                      return (
                        <div
                          key={hairdresser.id}
                          onClick={() => {
                            if (!hasActiveSubscription) {
                              setSelectedHairdresser(hairdresser)
                            }
                          }}
                          className={`p-3 transition-colors ${hasActiveSubscription
                              ? 'opacity-60 cursor-not-allowed bg-muted/30'
                              : 'cursor-pointer hover:bg-muted'
                            } ${selectedHairdresser?.id === hairdresser.id ? 'bg-primary/10' : ''
                            }`}
                        >
                          <div className="flex items-center space-x-3">
                            {hairdresser.avatar_url ? (
                              <img
                                src={hairdresser.avatar_url}
                                alt={hairdresser.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-primary font-bold">
                                  {hairdresser.name.charAt(0)}
                                </span>
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{hairdresser.name}</p>
                                {hasActiveSubscription && (
                                  <Badge className="bg-green-100 text-green-800 text-xs">
                                    {hairdresser.activeSubscription?.subscription_type === 'standard' && 'Standard'}
                                    {hairdresser.activeSubscription?.subscription_type === 'boost' && 'Boost'}
                                    {hairdresser.activeSubscription?.subscription_type === 'rookie' && 'Rookie'}
                                    {hairdresser.activeSubscription?.subscription_type === 'ambassador' && 'Ambassadeur'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {hairdresser.users?.email || hairdresser.phone || 'N/A'}
                              </p>
                              {hasActiveSubscription && (
                                <p className="text-xs text-orange-600 mt-1">
                                  Abonnement actif - impossible d'assigner
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Coiffeur sélectionné */}
                {selectedHairdresser && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <p className="text-sm font-medium mb-2">Coiffeur sélectionné:</p>
                    <div className="flex items-center space-x-3">
                      {selectedHairdresser.avatar_url ? (
                        <img
                          src={selectedHairdresser.avatar_url}
                          alt={selectedHairdresser.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-bold text-lg">
                            {selectedHairdresser.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-bold">{selectedHairdresser.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedHairdresser.users?.email || selectedHairdresser.phone || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Type d'abonnement */}
                <div className="space-y-2">
                  <Label htmlFor="subscription-type">Type d'abonnement</Label>
                  <Select value={selectedSubscriptionType} onValueChange={setSelectedSubscriptionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="boost">Boost</SelectItem>
                      <SelectItem value="rookie">Rookie</SelectItem>
                      <SelectItem value="ambassador">Ambassadeur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date de fin */}
                <div className="space-y-2">
                  <Label htmlFor="end-date">Date de fin</Label>
                  <div className="flex items-center space-x-4">
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={isIndefinite}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1"
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="indefinite"
                        checked={isIndefinite}
                        onCheckedChange={(checked) => {
                          setIsIndefinite(checked as boolean)
                          if (checked) setEndDate('')
                        }}
                      />
                      <Label htmlFor="indefinite" className="text-sm cursor-pointer">
                        Indéfiniment
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Raison */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Raison (optionnel)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Ex: Partenariat commercial, Beta testeur..."
                    value={giftedReason}
                    onChange={(e) => setGiftedReason(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAssignDialogOpen(false)
                      setSelectedHairdresser(null)
                      setSelectedSubscriptionType('standard')
                      setEndDate('')
                      setIsIndefinite(false)
                      setGiftedReason('')
                      setSearchHairdresser('')
                    }}
                    disabled={isSubmitting}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleAssignSubscription}
                    disabled={!selectedHairdresser || isSubmitting}
                  >
                    {isSubmitting ? 'Assignation...' : 'Assigner'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/subscriptions/fees')}
            className="flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Gérer les commissions</span>
          </Button>
        </div>
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
                  <TableHead>Offert</TableHead>
                  <TableHead>Stripe ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSubscriptions.map((subscription) => (
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
                      ) : (
                        <Badge className="bg-purple-100 text-purple-800">Indéfini</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {subscription.is_gifted ? (
                        <div className="flex items-center space-x-1">
                          <Gift className="w-4 h-4 text-pink-500" />
                          <Badge className="bg-pink-100 text-pink-800">Oui</Badge>
                        </div>
                      ) : (
                        <Badge variant="outline">Non</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {subscription.stripe_subscription_id || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {subscription.is_gifted && subscription.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setSubscriptionToDelete(subscription)
                            setIsDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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

          {filteredSubscriptions.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredSubscriptions.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmation de suppression */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'abonnement offert</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'abonnement offert de{' '}
              <span className="font-semibold">{subscriptionToDelete?.hairdresser?.name}</span> ?
              <br /><br />
              Cette action est irréversible. Le coiffeur perdra immédiatement l'accès aux fonctionnalités de son abonnement{' '}
              <span className="font-semibold capitalize">{subscriptionToDelete?.subscription_type}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGiftedSubscription}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
