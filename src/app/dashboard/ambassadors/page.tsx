'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { motion } from 'framer-motion'
import { Crown, Search, UserPlus, Trash2, Calendar, Award } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type Ambassador = {
  id: string
  hairdresser_id: string
  added_by_admin_id: string | null
  reason: string | null
  added_at: string | null
  is_active: boolean
  hairdresser?: {
    name: string
    avatar_url?: string
    email?: string
    phone?: string
  }
  admin?: {
    user_id: string
    users?: {
      email: string
    }
  }
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
}

export default function AmbassadorsPage() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([])
  const [filteredAmbassadors, setFilteredAmbassadors] = useState<Ambassador[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // Formulaire d'ajout
  const [searchHairdresser, setSearchHairdresser] = useState('')
  const [hairdressers, setHairdressers] = useState<Hairdresser[]>([])
  const [selectedHairdresser, setSelectedHairdresser] = useState<Hairdresser | null>(null)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  // Stats
  const [stats, setStats] = useState({
    total_ambassadors: 0,
    active_ambassadors: 0,
  })

  useEffect(() => {
    fetchAmbassadors()
  }, [])

  useEffect(() => {
    filterAmbassadors()
    calculateStats()
  }, [ambassadors, searchTerm])

  useEffect(() => {
    if (searchHairdresser.length >= 2) {
      searchHairdressers()
    } else {
      setHairdressers([])
    }
  }, [searchHairdresser])

  const fetchAmbassadors = async () => {
    try {
      const { data, error } = await supabase
        .from('ambassador_whitelist')
        .select(`
          *,
          hairdressers (
            name,
            avatar_url,
            phone,
            user_id
          ),
          admins!ambassador_whitelist_added_by_admin_id_fkey (
            user_id
          )
        `)
        .order('added_at', { ascending: false })

      if (error) throw error

      // Récupérer les emails des utilisateurs pour les coiffeurs et admins
      const enrichedData = await Promise.all((data || []).map(async (ambassador) => {
        // Email du coiffeur
        if (ambassador.hairdressers?.user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', ambassador.hairdressers.user_id)
            .single()

          if (userData) {
            ambassador.hairdressers.email = userData.email
          }
        }

        // Email de l'admin
        if (ambassador.admins?.user_id) {
          const { data: adminData } = await supabase
            .auth.admin.getUserById(ambassador.admins.user_id)

          if (adminData?.user) {
            ambassador.admin = {
              user_id: ambassador.admins.user_id,
              users: {
                email: adminData.user.email || ''
              }
            }
          }
        }

        return {
          ...ambassador,
          hairdresser: Array.isArray(ambassador.hairdressers)
            ? ambassador.hairdressers[0]
            : ambassador.hairdressers
        }
      }))

      setAmbassadors(enrichedData)
    } catch (error) {
      console.error('Erreur lors du chargement des ambassadeurs:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les ambassadeurs',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
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

      // Récupérer les emails des coiffeurs
      const enrichedData = await Promise.all((data || []).map(async (hairdresser) => {
        if (hairdresser.user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', hairdresser.user_id)
            .single()

          if (userData) {
            return {
              ...hairdresser,
              users: { email: userData.email }
            }
          }
        }
        return hairdresser
      }))

      setHairdressers(enrichedData)
    } catch (error) {
      console.error('Erreur lors de la recherche de coiffeurs:', error)
    }
  }

  const filterAmbassadors = () => {
    let filtered = ambassadors

    if (searchTerm) {
      filtered = filtered.filter(amb =>
        amb.hairdresser?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        amb.hairdresser?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredAmbassadors(filtered)
  }

  const calculateStats = () => {
    const active = ambassadors.filter(a => a.is_active).length
    setStats({
      total_ambassadors: ambassadors.length,
      active_ambassadors: active,
    })
  }

  const handleAddAmbassador = async () => {
    if (!selectedHairdresser) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un coiffeur',
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

      // Vérifier si le coiffeur n'est pas déjà ambassadeur
      const { data: existing } = await supabase
        .from('ambassador_whitelist')
        .select('id')
        .eq('hairdresser_id', selectedHairdresser.id)
        .single()

      if (existing) {
        toast({
          title: 'Erreur',
          description: 'Ce coiffeur est déjà ambassadeur',
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }

      // Ajouter à la whitelist
      const { error: whitelistError } = await supabase
        .from('ambassador_whitelist')
        .insert({
          hairdresser_id: selectedHairdresser.id,
          added_by_admin_id: adminData.id,
          reason: reason || null,
          is_active: true,
        })

      if (whitelistError) throw whitelistError

      // Créer l'abonnement ambassadeur
      const { error: subscriptionError } = await supabase
        .from('hairdresser_subscriptions')
        .insert({
          hairdresser_id: selectedHairdresser.id,
          subscription_type: 'ambassador',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // +1 an
          is_gifted: true,
          gifted_by_admin_id: adminData.id,
          gifted_reason: reason || 'Programme Ambassadeur',
        })

      if (subscriptionError) throw subscriptionError

      toast({
        title: 'Succès',
        description: 'Ambassadeur ajouté avec succès',
      })

      // Réinitialiser le formulaire
      setIsAddDialogOpen(false)
      setSelectedHairdresser(null)
      setReason('')
      setSearchHairdresser('')

      // Recharger la liste
      fetchAmbassadors()
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'ambassadeur:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter l\'ambassadeur',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveAmbassador = async (ambassadorId: string, hairdresserId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer ce statut ambassadeur ?')) {
      return
    }

    try {
      // Désactiver dans la whitelist
      const { error: whitelistError } = await supabase
        .from('ambassador_whitelist')
        .update({ is_active: false })
        .eq('id', ambassadorId)

      if (whitelistError) throw whitelistError

      // Annuler l'abonnement ambassadeur
      const { error: subscriptionError } = await supabase
        .from('hairdresser_subscriptions')
        .update({ status: 'canceled' })
        .eq('hairdresser_id', hairdresserId)
        .eq('subscription_type', 'ambassador')

      if (subscriptionError) throw subscriptionError

      toast({
        title: 'Succès',
        description: 'Statut ambassadeur retiré avec succès',
      })

      // Recharger la liste
      fetchAmbassadors()
    } catch (error) {
      console.error('Erreur lors du retrait de l\'ambassadeur:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de retirer le statut ambassadeur',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Crown className="w-8 h-8 text-yellow-500" />
            Ambassadeurs
          </h1>
          <p className="text-muted-foreground">Gestion des coiffeurs ambassadeurs (commission 3%)</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <UserPlus className="w-4 h-4" />
              <span>Ajouter un ambassadeur</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ajouter un ambassadeur</DialogTitle>
              <DialogDescription>
                Recherchez un coiffeur et ajoutez-le à la liste des ambassadeurs
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
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {hairdressers.map((hairdresser) => (
                    <div
                      key={hairdresser.id}
                      onClick={() => setSelectedHairdresser(hairdresser)}
                      className={`p-3 cursor-pointer hover:bg-muted transition-colors ${
                        selectedHairdresser?.id === hairdresser.id ? 'bg-primary/10' : ''
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
                          <p className="font-medium">{hairdresser.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {hairdresser.users?.email || hairdresser.phone || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
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

              {/* Raison */}
              <div className="space-y-2">
                <Label htmlFor="reason">Raison (optionnel)</Label>
                <Textarea
                  id="reason"
                  placeholder="Ex: Partenaire VIP - Influenceur 10k"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false)
                    setSelectedHairdresser(null)
                    setReason('')
                    setSearchHairdresser('')
                  }}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleAddAmbassador}
                  disabled={!selectedHairdresser || isSubmitting}
                >
                  {isSubmitting ? 'Ajout en cours...' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total ambassadeurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold">{stats.total_ambassadors}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ambassadeurs actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Crown className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.active_ambassadors}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Ambassadors Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            <span>Ambassadeurs ({filteredAmbassadors.length})</span>
          </CardTitle>
          <CardDescription>
            Liste des coiffeurs ayant le statut ambassadeur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coiffeur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Ajouté par</TableHead>
                  <TableHead>Date d'ajout</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAmbassadors.map((ambassador) => (
                  <motion.tr
                    key={ambassador.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-3">
                        {ambassador.hairdresser?.avatar_url ? (
                          <img
                            src={ambassador.hairdresser.avatar_url}
                            alt={ambassador.hairdresser.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-bold text-sm">
                              {ambassador.hairdresser?.name?.charAt(0) || 'N'}
                            </span>
                          </div>
                        )}
                        <span>{ambassador.hairdresser?.name || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ambassador.hairdresser?.email || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ambassador.hairdresser?.phone || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{ambassador.reason || 'N/A'}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ambassador.admin?.users?.email || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {ambassador.added_at ? (
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(ambassador.added_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {ambassador.is_active ? (
                        <Badge className="bg-green-100 text-green-800">Actif</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {ambassador.is_active && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveAmbassador(ambassador.id, ambassador.hairdresser_id)}
                          className="flex items-center space-x-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Retirer</span>
                        </Button>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAmbassadors.length === 0 && (
            <div className="text-center py-8">
              <Crown className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun ambassadeur trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
