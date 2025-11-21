'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { motion } from 'framer-motion'
import { Wallet, TrendingUp, Users, AlertCircle, CreditCard, ArrowRight, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'

type PaymentWithDetails = {
  id: string
  amount: number
  currency: string
  status: string
  payment_type: string
  created_at: string
  hairdresser?: {
    name: string
  }
}

type StripeAccount = {
  id: string
  hairdresser_id: string
  onboarding_status: string
  charges_enabled: boolean
  payouts_enabled: boolean
  hairdresser?: {
    name: string
  }
}

export default function StripePaymentsDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total_accounts: 0,
    active_accounts: 0,
    pending_accounts: 0,
    total_transactions: 0,
    total_volume: 0
  })
  const [recentPayments, setRecentPayments] = useState<PaymentWithDetails[]>([])
  const [accountsNeedingAttention, setAccountsNeedingAttention] = useState<StripeAccount[]>([])
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Récupérer les comptes Stripe
      const { data: accountsData, error: accountsError } = await supabase
        .from('hairdresser_stripe_accounts')
        .select(`
          *,
          hairdressers (
            name
          )
        `)

      if (accountsError) {
        console.error('Erreur comptes:', accountsError)
      }

      // Mapper les données pour avoir un format cohérent
      const accounts = (accountsData || []).map(account => ({
        ...account,
        hairdresser: Array.isArray(account.hairdressers)
          ? account.hairdressers[0]
          : account.hairdressers
      }))

      // Récupérer les paiements
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('stripe_payments')
        .select(`
          *,
          hairdressers (
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (paymentsError) {
        console.error('Erreur paiements:', paymentsError)
      }

      // Mapper les données pour avoir un format cohérent
      const payments = (paymentsData || []).map(payment => ({
        ...payment,
        hairdresser: Array.isArray(payment.hairdressers)
          ? payment.hairdressers[0]
          : payment.hairdressers
      }))

      // Calculer les stats
      const totalAccounts = accounts?.length || 0
      const activeAccounts = accounts?.filter(a => a.onboarding_status === 'completed' && a.charges_enabled && a.payouts_enabled).length || 0
      const pendingAccounts = accounts?.filter(a => a.onboarding_status === 'pending').length || 0
      const totalTransactions = payments?.length || 0
      const totalVolume = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

      setStats({
        total_accounts: totalAccounts,
        active_accounts: activeAccounts,
        pending_accounts: pendingAccounts,
        total_transactions: totalTransactions,
        total_volume: totalVolume
      })

      // Derniers paiements (10 derniers)
      setRecentPayments((payments || []).slice(0, 10))

      // Comptes nécessitant attention (onboarding non terminé ou permissions manquantes)
      const needsAttention = accounts?.filter(
        a => a.onboarding_status !== 'completed' || !a.charges_enabled || !a.payouts_enabled
      ) || []
      setAccountsNeedingAttention(needsAttention.slice(0, 5))

    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge className="bg-green-100 text-green-800">Réussi</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Échoué</Badge>
      case 'canceled':
        return <Badge className="bg-gray-100 text-gray-800">Annulé</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'booking':
        return <Badge variant="default">Réservation</Badge>
      case 'subscription':
        return <Badge className="bg-purple-100 text-purple-800">Abonnement</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-muted rounded animate-pulse" />
          <div className="h-96 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paiements Stripe</h1>
        <p className="text-muted-foreground">Vue d'ensemble des comptes et transactions Stripe</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Comptes connectés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.total_accounts}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.active_accounts} actifs
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                En attente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-bold">{stats.pending_accounts}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Onboarding incomplet
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-purple-500" />
                <span className="text-2xl font-bold">{stats.total_transactions}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total historique
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Volume total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.total_volume.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tous paiements confondus
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Wallet className="w-5 h-5" />
                  <span>Transactions récentes</span>
                </CardTitle>
                <CardDescription>Les 10 derniers paiements</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/stripe-payments/transactions')}
              >
                Voir tout
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-sm">{payment.hairdresser?.name || 'N/A'}</p>
                      {getTypeBadge(payment.payment_type)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(payment.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold">
                      {Number(payment.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {payment.currency.toUpperCase()}
                    </p>
                    {getStatusBadge(payment.status)}
                  </div>
                </motion.div>
              ))}

              {recentPayments.length === 0 && (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucune transaction récente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Accounts Needing Attention */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <span>Comptes nécessitant attention</span>
                </CardTitle>
                <CardDescription>Onboarding incomplet ou permissions manquantes</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/stripe-payments/accounts')}
              >
                Voir tout
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accountsNeedingAttention.map((account) => (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{account.hairdresser?.name || 'N/A'}</p>
                    <div className="flex items-center space-x-2">
                      {getOnboardingBadge(account.onboarding_status)}
                      {!account.charges_enabled && (
                        <Badge variant="outline" className="text-xs">Paiements désactivés</Badge>
                      )}
                      {!account.payouts_enabled && (
                        <Badge variant="outline" className="text-xs">Virements désactivés</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard/stripe-payments/accounts')}
                  >
                    Gérer
                  </Button>
                </motion.div>
              ))}

              {accountsNeedingAttention.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Tous les comptes sont en règle</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
          <CardDescription>Accès rapide aux principales fonctionnalités</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start space-y-2"
              onClick={() => router.push('/dashboard/stripe-payments/accounts')}
            >
              <Users className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Gérer les comptes</p>
                <p className="text-xs text-muted-foreground">Comptes Stripe Connect</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start space-y-2"
              onClick={() => router.push('/dashboard/stripe-payments/transactions')}
            >
              <CreditCard className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Voir les transactions</p>
                <p className="text-xs text-muted-foreground">Historique complet</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start space-y-2"
              onClick={() => router.push('/dashboard/subscriptions')}
            >
              <Calendar className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Abonnements</p>
                <p className="text-xs text-muted-foreground">Gérer les abonnements</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
