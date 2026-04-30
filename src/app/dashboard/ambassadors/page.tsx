'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { fetchAllPaginated } from '@/lib/supabase/pagination'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { motion } from 'framer-motion'
import { Crown, Search, UserPlus, Calendar, Award, MoreVertical, BarChart3, Link2, Copy, User, Trash2 } from 'lucide-react'
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
  // Données du lien de parrainage (jointure)
  ambassador_link?: {
    id: string
    slug: string
    is_active: boolean
  } | null
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
  const router = useRouter()
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([])
  const [filteredAmbassadors, setFilteredAmbassadors] = useState<Ambassador[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // Formulaire d'ajout
  const [searchHairdresser, setSearchHairdresser] = useState('')
  const [hairdressers, setHairdressers] = useState<Hairdresser[]>([])
  const [selectedHairdresser, setSelectedHairdresser] = useState<Hairdresser | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Configurer lien
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const [linkAmbassador, setLinkAmbassador] = useState<Ambassador | null>(null)
  const [linkSlug, setLinkSlug] = useState('')
  const [linkActive, setLinkActive] = useState(true)
  const [linkSaving, setLinkSaving] = useState(false)
  const [slugError, setSlugError] = useState('')

  // Modal Retirer
  const [removeAmbassador, setRemoveAmbassador] = useState<Ambassador | null>(null)
  const [removing, setRemoving] = useState(false)

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
      const data = await fetchAllPaginated<any>((from, to) =>
        supabase
          .from('ambassador_whitelist')
          .select(`
            *,
            hairdressers (
              id,
              name,
              avatar_url,
              phone,
              user_id
            )
          `)
          .eq('is_active', true)
          .order('added_at', { ascending: false })
          .range(from, to)
      )

      // Récupérer les emails et les liens de parrainage
      const enrichedData = await Promise.all(data.map(async (ambassador) => {
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

        // Lien de parrainage
        const hairdresserId = ambassador.hairdressers?.id || ambassador.hairdresser_id
        const { data: linkData } = await supabase
          .from('ambassador_links')
          .select('id, slug, is_active')
          .eq('hairdresser_id', hairdresserId)
          .maybeSingle()

        return {
          ...ambassador,
          hairdresser: Array.isArray(ambassador.hairdressers)
            ? ambassador.hairdressers[0]
            : ambassador.hairdressers,
          ambassador_link: linkData || null,
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
        .select(`id, name, avatar_url, phone, user_id`)
        .ilike('name', `%${searchHairdresser}%`)
        .limit(10)

      if (error) throw error

      const enrichedData = await Promise.all((data || []).map(async (hairdresser) => {
        if (hairdresser.user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', hairdresser.user_id)
            .single()

          if (userData) {
            return { ...hairdresser, users: { email: userData.email } }
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

  // ── Ajouter un ambassadeur (sans raison) ──
  const handleAddAmbassador = async () => {
    if (!selectedHairdresser) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner un coiffeur', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté')

      const { data: adminData } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!adminData) throw new Error('Admin non trouvé')

      // Vérifier si déjà ambassadeur (seulement les actifs)
      const { data: existing } = await supabase
        .from('ambassador_whitelist')
        .select('id, is_active')
        .eq('hairdresser_id', selectedHairdresser.id)
        .maybeSingle()

      if (existing && existing.is_active) {
        toast({ title: 'Erreur', description: 'Ce coiffeur est déjà ambassadeur', variant: 'destructive' })
        setIsSubmitting(false)
        return
      }

      // Si existait mais inactif → réactiver
      if (existing && !existing.is_active) {
        const { error: reactivateError } = await supabase
          .from('ambassador_whitelist')
          .update({ is_active: true, added_by_admin_id: adminData.id })
          .eq('id', existing.id)

        if (reactivateError) throw reactivateError

        // Réactiver aussi le lien s'il existe
        await supabase
          .from('ambassador_links')
          .update({ is_active: true })
          .eq('hairdresser_id', selectedHairdresser.id)

        // Réactiver ou créer l'abonnement
        const { data: existingSub } = await supabase
          .from('hairdresser_subscriptions')
          .select('id')
          .eq('hairdresser_id', selectedHairdresser.id)
          .eq('subscription_type', 'ambassador')
          .maybeSingle()

        if (existingSub) {
          await supabase
            .from('hairdresser_subscriptions')
            .update({
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('id', existingSub.id)
        } else {
          const { error: subscriptionError } = await supabase
            .from('hairdresser_subscriptions')
            .insert({
              hairdresser_id: selectedHairdresser.id,
              subscription_type: 'ambassador',
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              is_gifted: true,
              gifted_by_admin_id: adminData.id,
              gifted_reason: 'Programme Ambassadeur',
            })
          if (subscriptionError) throw subscriptionError
        }

        toast({ title: 'Succès', description: 'Ambassadeur réactivé avec succès' })
        setIsAddDialogOpen(false)
        setSelectedHairdresser(null)
        setSearchHairdresser('')
        fetchAmbassadors()
        return
      }

      // Ajouter à la whitelist (sans raison)
      const { error: whitelistError } = await supabase
        .from('ambassador_whitelist')
        .insert({
          hairdresser_id: selectedHairdresser.id,
          added_by_admin_id: adminData.id,
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
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          is_gifted: true,
          gifted_by_admin_id: adminData.id,
          gifted_reason: 'Programme Ambassadeur',
        })

      if (subscriptionError) throw subscriptionError

      toast({ title: 'Succès', description: 'Ambassadeur ajouté avec succès' })

      setIsAddDialogOpen(false)
      setSelectedHairdresser(null)
      setSearchHairdresser('')
      fetchAmbassadors()
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'ambassadeur:", error)
      toast({ title: 'Erreur', description: "Impossible d'ajouter l'ambassadeur", variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Option 2 : Configurer lien ──
  const openLinkDialog = (ambassador: Ambassador) => {
    setLinkAmbassador(ambassador)
    setLinkSlug(ambassador.ambassador_link?.slug || '')
    setLinkActive(ambassador.ambassador_link?.is_active ?? true)
    setSlugError('')
    setIsLinkDialogOpen(true)
  }

  const handleSaveLink = async () => {
    if (!linkAmbassador) return

    const slug = linkSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!slug) {
      setSlugError('Le slug ne peut pas être vide')
      return
    }

    setLinkSaving(true)
    setSlugError('')

    try {
      const hairdresserId = linkAmbassador.hairdresser_id

      // Vérifier unicité du slug (sauf si c'est le même ambassadeur)
      const { data: existingSlug } = await supabase
        .from('ambassador_links')
        .select('id, hairdresser_id')
        .eq('slug', slug)
        .maybeSingle()

      if (existingSlug && existingSlug.hairdresser_id !== hairdresserId) {
        setSlugError('Ce slug est déjà utilisé par un autre ambassadeur')
        setLinkSaving(false)
        return
      }

      // Vérifier si un lien existe déjà pour ce coiffeur
      const { data: currentLink } = await supabase
        .from('ambassador_links')
        .select('id')
        .eq('hairdresser_id', hairdresserId)
        .maybeSingle()

      if (currentLink) {
        // Mettre à jour le lien existant
        const { error } = await supabase
          .from('ambassador_links')
          .update({ slug, is_active: linkActive })
          .eq('id', currentLink.id)

        if (error) throw error
      } else {
        // Créer un nouveau lien
        const { error } = await supabase
          .from('ambassador_links')
          .insert({
            hairdresser_id: hairdresserId,
            slug,
            is_active: linkActive,
          })

        if (error) throw error
      }

      toast({ title: 'Succès', description: 'Lien de parrainage sauvegardé' })
      setIsLinkDialogOpen(false)
      fetchAmbassadors()
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du lien:', error)
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder le lien', variant: 'destructive' })
    } finally {
      setLinkSaving(false)
    }
  }

  // ── Option 3 : Copier le lien ──
  const handleCopyLink = async (ambassador: Ambassador) => {
    if (!ambassador.ambassador_link?.slug) {
      toast({ title: 'Aucun lien configuré', description: 'Utilisez "Configurer lien" pour définir un slug', variant: 'destructive' })
      return
    }

    const url = `parrainage.fady-app.fr/${ambassador.ambassador_link.slug}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Lien copié !', description: url })
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de copier le lien', variant: 'destructive' })
    }
  }

  // ── Option 5 : Retirer ──
  const handleConfirmRemove = async () => {
    if (!removeAmbassador || removing) return

    setRemoving(true)
    const errors: string[] = []

    try {
      // 1. Désactiver dans la whitelist
      const { error: whitelistError } = await supabase
        .from('ambassador_whitelist')
        .update({ is_active: false })
        .eq('id', removeAmbassador.id)

      if (whitelistError) errors.push('whitelist')

      // 2. Annuler l'abonnement ambassadeur
      const { error: subscriptionError } = await supabase
        .from('hairdresser_subscriptions')
        .update({ status: 'canceled' })
        .eq('hairdresser_id', removeAmbassador.hairdresser_id)
        .eq('subscription_type', 'ambassador')

      if (subscriptionError) errors.push('abonnement')

      // 3. Désactiver le lien (pas supprimer)
      const { error: linkError } = await supabase
        .from('ambassador_links')
        .update({ is_active: false })
        .eq('hairdresser_id', removeAmbassador.hairdresser_id)

      if (linkError) errors.push('lien')

      if (errors.length > 0) {
        toast({ title: 'Erreur partielle', description: `Échec sur : ${errors.join(', ')}. Contactez le support.`, variant: 'destructive' })
      } else {
        toast({ title: 'Succès', description: 'Statut ambassadeur retiré avec succès' })
      }

      setRemoveAmbassador(null)
      fetchAmbassadors()
    } catch (error) {
      console.error("Erreur lors du retrait de l'ambassadeur:", error)
      toast({ title: 'Erreur', description: 'Impossible de retirer le statut ambassadeur', variant: 'destructive' })
    } finally {
      setRemoving(false)
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
          <p className="text-muted-foreground">Gestion des coiffeurs ambassadeurs (commission 0%)</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) {
            setSelectedHairdresser(null)
            setSearchHairdresser('')
            setHairdressers([])
          }
        }}>
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

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false)
                    setSelectedHairdresser(null)
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
                  <TableHead>Date d'ajout</TableHead>
                  <TableHead className="w-[50px]">Actions</TableHead>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Option 1 : Dashboard parrainage */}
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/ambassadors/${ambassador.hairdresser_id}/referrals`)}
                          >
                            <BarChart3 className="w-4 h-4" />
                            Dashboard parrainage
                          </DropdownMenuItem>

                          {/* Option 2 : Configurer lien */}
                          <DropdownMenuItem onClick={() => openLinkDialog(ambassador)}>
                            <Link2 className="w-4 h-4" />
                            Configurer lien
                          </DropdownMenuItem>

                          {/* Option 3 : Copier le lien */}
                          <DropdownMenuItem onClick={() => handleCopyLink(ambassador)}>
                            <Copy className="w-4 h-4" />
                            Copier le lien
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Option 4 : Afficher profil */}
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/hairdressers/${ambassador.hairdresser_id}`)}
                          >
                            <User className="w-4 h-4" />
                            Afficher profil
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Option 5 : Retirer */}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setRemoveAmbassador(ambassador)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Retirer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* ── Modal : Configurer lien (Option 2) ── */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurer le lien de parrainage</DialogTitle>
            <DialogDescription>
              Définissez le slug unique pour {linkAmbassador?.hairdresser?.name || 'cet ambassadeur'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="link-slug">Slug du lien</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  parrainage.fady-app.fr/
                </span>
                <Input
                  id="link-slug"
                  placeholder="ex: donoobarber"
                  value={linkSlug}
                  onChange={(e) => {
                    setLinkSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    setSlugError('')
                  }}
                />
              </div>
              {slugError && (
                <p className="text-sm text-destructive">{slugError}</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="link-active">Lien actif</Label>
                <p className="text-sm text-muted-foreground">
                  {linkActive
                    ? 'Le lien est accessible publiquement'
                    : 'Le lien affichera une page "Lien invalide"'}
                </p>
              </div>
              <Switch
                id="link-active"
                checked={linkActive}
                onCheckedChange={setLinkActive}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)} disabled={linkSaving}>
                Annuler
              </Button>
              <Button onClick={handleSaveLink} disabled={linkSaving || !linkSlug.trim()}>
                {linkSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog : Confirmer retrait (Option 5) ── */}
      <AlertDialog open={!!removeAmbassador} onOpenChange={(open) => !open && setRemoveAmbassador(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le statut ambassadeur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir retirer le statut ambassadeur à{' '}
              <span className="font-semibold text-foreground">
                {removeAmbassador?.hairdresser?.name}
              </span>{' '}
              ? Son lien sera désactivé mais l'historique des parrainages sera conservé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? 'Retrait en cours...' : 'Retirer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
