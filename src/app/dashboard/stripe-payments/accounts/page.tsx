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
import { Users, Search, CheckCircle, XCircle, Calendar, Link as LinkIcon } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { toast } from 'sonner'

type StripeAccount = Database['public']['Tables']['hairdresser_stripe_accounts']['Row'] & {
  hairdresser?: {
    name: string
    phone?: string
    email?: string
  }
}

export default function StripeAccountsPage() {
  const [accounts, setAccounts] = useState<StripeAccount[]>([])
  const [filteredAccounts, setFilteredAccounts] = useState<StripeAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    fetchAccounts()
  }, [])

  useEffect(() => {
    filterAccounts()
  }, [accounts, searchTerm, statusFilter])

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('hairdresser_stripe_accounts')
        .select(`
          *,
          hairdressers (
            name,
            phone,
            user_id
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur Supabase:', error)
        throw error
      }

      // Enrichir avec email des users si disponible
      const enrichedAccounts = await Promise.all(
        (data || []).map(async (account) => {
          // Gérer le cas où hairdressers peut être un tableau ou un objet
          const hairdresserData = Array.isArray(account.hairdressers)
            ? account.hairdressers[0]
            : account.hairdressers

          if (hairdresserData?.user_id) {
            const { data: userData } = await supabase
              .from('users')
              .select('email')
              .eq('id', hairdresserData.user_id)
              .single()

            return {
              ...account,
              hairdresser: {
                ...hairdresserData,
                email: userData?.email
              }
            }
          }
          return {
            ...account,
            hairdresser: hairdresserData
          }
        })
      )

      setAccounts(enrichedAccounts)
    } catch (error) {
      console.error('Erreur lors du chargement des comptes:', error)
      toast.error('Erreur lors du chargement des comptes Stripe')
    } finally {
      setLoading(false)
    }
  }

  const filterAccounts = () => {
    let filtered = accounts

    // Filtre par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.hairdresser?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.stripe_account_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.hairdresser?.phone?.includes(searchTerm) ||
        account.hairdresser?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(account => account.onboarding_status === statusFilter)
    }

    setFilteredAccounts(filtered)
  }

  const getOnboardingBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Terminé</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejeté</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copié dans le presse-papiers')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-24 bg-muted rounded animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Comptes Stripe Connect</h1>
        <p className="text-muted-foreground">Gestion des comptes Stripe Connect des coiffeurs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total comptes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{accounts.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">
                {accounts.filter(a => a.onboarding_status === 'completed' && a.charges_enabled && a.payouts_enabled).length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold">
                {accounts.filter(a => a.onboarding_status === 'pending').length}
              </span>
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
                  placeholder="Rechercher par nom, email, téléphone ou ID Stripe..."
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
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Comptes Stripe Connect ({filteredAccounts.length})</span>
          </CardTitle>
          <CardDescription>
            Liste des comptes Stripe Connect associés aux coiffeurs
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
                  <TableHead>Stripe Account ID</TableHead>
                  <TableHead>Statut onboarding</TableHead>
                  <TableHead>Paiements</TableHead>
                  <TableHead>Virements</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <motion.tr
                    key={account.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell className="font-medium">
                      {account.hairdresser?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{account.hairdresser?.email || 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{account.hairdresser?.phone || 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {account.stripe_account_id}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(account.stripe_account_id)}
                          className="h-6 w-6 p-0"
                        >
                          <LinkIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getOnboardingBadge(account.onboarding_status)}
                    </TableCell>
                    <TableCell>
                      {account.charges_enabled ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      {account.payouts_enabled ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(account.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.onboarding_link && account.onboarding_status !== 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (account.onboarding_link) {
                              window.open(account.onboarding_link, '_blank')
                            }
                          }}
                        >
                          Continuer onboarding
                        </Button>
                      )}
                      {account.onboarding_status === 'completed' && (
                        <Badge variant="outline" className="bg-green-50">
                          Configuré
                        </Badge>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAccounts.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun compte trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
