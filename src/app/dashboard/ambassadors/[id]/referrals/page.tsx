'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { motion } from 'framer-motion'
import { ArrowLeft, Users, Briefcase, GraduationCap, Scissors, Filter, Calendar } from 'lucide-react'

type Referral = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  profile_type: 'PRO' | 'DIPLÔMÉ' | 'AMATEUR' | null
  registered_at: string | null
}

type AmbassadorInfo = {
  name: string
  avatar_url?: string
  slug?: string
}

type ProfileFilter = 'Tous' | 'PRO' | 'DIPLÔMÉ' | 'AMATEUR'

export default function ReferralsDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const hairdresserId = params.id as string

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [ambassador, setAmbassador] = useState<AmbassadorInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProfileFilter>('Tous')

  const supabase = useMemo(() => createClient(), [])

  const stats = useMemo(() => {
    const total = referrals.length
    const pro = referrals.filter(r => r.profile_type === 'PRO').length
    const diplome = referrals.filter(r => r.profile_type === 'DIPLÔMÉ').length
    const amateur = referrals.filter(r => r.profile_type === 'AMATEUR').length
    return { total, pro, diplome, amateur }
  }, [referrals])

  const filteredReferrals = useMemo(() => {
    if (filter === 'Tous') return referrals
    return referrals.filter(r => r.profile_type === filter)
  }, [referrals, filter])

  useEffect(() => {
    fetchData()
  }, [hairdresserId])

  const fetchData = async () => {
    try {
      // Récupérer les infos du coiffeur
      const { data: hairdresser } = await supabase
        .from('hairdressers')
        .select('name, avatar_url')
        .eq('id', hairdresserId)
        .maybeSingle()

      if (!hairdresser) {
        setAmbassador({ name: 'Ambassadeur introuvable' })
        setReferrals([])
        return
      }

      // Récupérer le lien de parrainage
      const { data: link } = await supabase
        .from('ambassador_links')
        .select('id, slug')
        .eq('hairdresser_id', hairdresserId)
        .maybeSingle()

      setAmbassador({
        name: hairdresser.name,
        avatar_url: hairdresser.avatar_url,
        slug: link?.slug,
      })

      // Récupérer les parrainages
      if (link) {
        const { data: referralsData, error } = await supabase
          .from('ambassador_referrals')
          .select('id, first_name, last_name, phone, email, profile_type, registered_at')
          .eq('ambassador_link_id', link.id)
          .order('registered_at', { ascending: false })

        if (error) throw error
        setReferrals(referralsData || [])
      } else {
        setReferrals([])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des parrainages:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/ambassadors')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div className="flex items-center gap-3">
          {ambassador?.avatar_url ? (
            <img
              src={ambassador.avatar_url}
              alt={ambassador.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold">
                {ambassador?.name?.charAt(0) || 'A'}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Dashboard parrainage — {ambassador?.name}
            </h1>
            {ambassador?.slug && (
              <p className="text-sm text-muted-foreground">
                ambassador.fady-app.fr/{ambassador.slug}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">PRO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-purple-500" />
                <span className="text-2xl font-bold">{stats.pro}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Diplômé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.diplome}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Amateur</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Scissors className="w-5 h-5 text-orange-500" />
                <span className="text-2xl font-bold">{stats.amateur}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tableau des inscrits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inscrits via le lien ({filteredReferrals.length})</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  {filter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(['Tous', 'PRO', 'DIPLÔMÉ', 'AMATEUR'] as ProfileFilter[]).map((f) => (
                  <DropdownMenuItem key={f} onClick={() => setFilter(f)}>
                    {f}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prénom</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Profil</TableHead>
                  <TableHead>Date d'inscription</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrals.map((referral) => (
                  <motion.tr
                    key={referral.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell className="font-medium">
                      {referral.first_name || 'N/A'}
                    </TableCell>
                    <TableCell>{referral.last_name || 'N/A'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {referral.phone || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {referral.email || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {referral.profile_type ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          referral.profile_type === 'PRO'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : referral.profile_type === 'DIPLÔMÉ'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                        }`}>
                          {referral.profile_type}
                        </span>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {referral.registered_at ? (
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(referral.registered_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      ) : 'N/A'}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredReferrals.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {referrals.length === 0
                  ? 'Aucun parrainage enregistré'
                  : 'Aucun résultat pour ce filtre'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
