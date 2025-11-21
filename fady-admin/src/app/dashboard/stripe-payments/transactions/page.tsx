'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { CreditCard, Search, Calendar, TrendingUp, DollarSign, Eye, Link as LinkIcon } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Payment = Database['public']['Tables']['stripe_payments']['Row'] & {
  hairdresser?: {
    name: string
  }
  booking?: {
    id: string
    booking_date: string
    booking_time: string
  }
}

export default function TransactionsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const supabase = createClient()
  const router = useRouter()

  // Stats
  const [stats, setStats] = useState({
    total_amount: 0,
    succeeded_count: 0,
    failed_count: 0,
    pending_count: 0
  })

  useEffect(() => {
    fetchPayments()
  }, [])

  useEffect(() => {
    filterPayments()
    calculateStats()
  }, [payments, searchTerm, statusFilter, typeFilter])

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_payments')
        .select(`
          *,
          hairdressers (
            name
          ),
          bookings (
            id,
            booking_date,
            booking_time
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur Supabase:', error)
        throw error
      }

      // Mapper les données pour avoir un format cohérent
      const mappedPayments = (data || []).map(payment => ({
        ...payment,
        hairdresser: Array.isArray(payment.hairdressers)
          ? payment.hairdressers[0]
          : payment.hairdressers,
        booking: Array.isArray(payment.bookings)
          ? payment.bookings[0]
          : payment.bookings
      }))

      setPayments(mappedPayments)
    } catch (error) {
      console.error('Erreur lors du chargement des paiements:', error)
      toast.error('Erreur lors du chargement des paiements')
    } finally {
      setLoading(false)
    }
  }

  const filterPayments = () => {
    let filtered = payments

    // Filtre par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(payment =>
        payment.hairdresser?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.stripe_payment_intent_id?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(payment => payment.status === statusFilter)
    }

    // Filtre par type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(payment => payment.payment_type === typeFilter)
    }

    setFilteredPayments(filtered)
  }

  const calculateStats = () => {
    const totalAmount = payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.amount), 0)
    const succeededCount = payments.filter(p => p.status === 'succeeded').length
    const failedCount = payments.filter(p => p.status === 'failed').length
    const pendingCount = payments.filter(p => p.status === 'pending').length

    setStats({
      total_amount: totalAmount,
      succeeded_count: succeededCount,
      failed_count: failedCount,
      pending_count: pendingCount
    })
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copié dans le presse-papiers')
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
        <p className="text-muted-foreground">Historique complet des paiements Stripe</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Volume total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">
                {stats.total_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Paiements réussis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Réussis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.succeeded_count}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Échoués
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold">{stats.failed_count}</span>
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
              <CreditCard className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold">{stats.pending_count}</span>
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
                  placeholder="Rechercher par coiffeur ou ID Stripe..."
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
                <SelectItem value="succeeded">Réussi</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="failed">Échoué</SelectItem>
                <SelectItem value="canceled">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="booking">Réservation</SelectItem>
                <SelectItem value="subscription">Abonnement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Transactions ({filteredPayments.length})</span>
          </CardTitle>
          <CardDescription>
            Historique complet des paiements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Coiffeur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Stripe Payment ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <motion.tr
                    key={payment.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(payment.created_at).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payment.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.hairdresser?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {getTypeBadge(payment.payment_type)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {Number(payment.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="uppercase text-sm font-medium">
                        {payment.currency || 'EUR'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(payment.status)}
                    </TableCell>
                    <TableCell>
                      {payment.stripe_payment_intent_id ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono text-muted-foreground max-w-[150px] truncate">
                            {payment.stripe_payment_intent_id}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(payment.stripe_payment_intent_id!)}
                            className="h-6 w-6 p-0"
                          >
                            <LinkIcon className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.booking_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/bookings/${payment.booking_id}`)}
                          className="flex items-center space-x-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Voir réservation</span>
                        </Button>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune transaction trouvée</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
