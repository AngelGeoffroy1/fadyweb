'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { motion } from 'framer-motion'
import { Calendar, Wallet, RotateCw, ExternalLink } from 'lucide-react'

type PayoutLog = {
  id: string
  hairdresser_id: string
  amount: number
  date_virement: string
  stripe_transfer_id: string | null
  payout_status: 'pending' | 'paid' | 'refunded' | 'failed'
  bookings_count: number
  created_at: string
  hairdresser?: { name: string } | null
}

type PayoutCandidate = {
  total_price: number | null
  fady_commission_user: number | null
  fady_commission_barber: number | null
  booking_date: string | null
  booking_time: string | null
}

const STATUS_LABEL: Record<PayoutLog['payout_status'], { label: string; tone: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  paid: { label: 'Versé', tone: 'default' },
  pending: { label: 'En attente', tone: 'secondary' },
  refunded: { label: 'Remboursé', tone: 'outline' },
  failed: { label: 'Échec', tone: 'destructive' },
}

export default function PayoutsDashboard() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<PayoutLog[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | PayoutLog['payout_status']>('all')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  async function loadEligiblePayoutCandidates() {
    const today = new Date().toISOString().slice(0, 10)
    const pageSize = 1000
    let page = 0
    let rows: PayoutCandidate[] = []

    while (true) {
      const from = page * pageSize
      const to = from + pageSize - 1

      const { data, error } = await supabase
        .from('bookings')
        .select('total_price, fady_commission_user, fady_commission_barber, booking_date, booking_time')
        .eq('payout_status', 'pending')
        .eq('payment_method', 'card')
        .eq('status', 'completed')
        .not('stripe_payment_intent_id', 'is', null)
        .lte('funds_available_on', today)
        .range(from, to)

      if (error) {
        throw error
      }

      rows = rows.concat((data ?? []) as PayoutCandidate[])

      if (!data || data.length < pageSize) {
        break
      }

      page += 1
    }

    return rows
  }

  async function load() {
    setLoading(true)
    try {
      let query = supabase
        .from('payout_logs')
        .select('id, hairdresser_id, amount, date_virement, stripe_transfer_id, payout_status, bookings_count, created_at, hairdresser:hairdresser_id(name)')
        .order('date_virement', { ascending: false })
        .limit(100)

      if (statusFilter !== 'all') {
        query = query.eq('payout_status', statusFilter)
      }

      const { data: payoutLogs } = await query
      setLogs((payoutLogs ?? []) as unknown as PayoutLog[])

      const payoutCutoff = Date.now() - 48 * 60 * 60 * 1000
      const pending = await loadEligiblePayoutCandidates()
      const total = pending.reduce((acc, b) => {
        if (!b.booking_date || !b.booking_time) {
          return acc
        }
        const bookingDateTime = new Date(`${b.booking_date}T${b.booking_time}`)
        if (Number.isNaN(bookingDateTime.getTime()) || bookingDateTime.getTime() >= payoutCutoff) {
          return acc
        }

        const t = Number(b.total_price ?? 0)
        const u = Number(b.fady_commission_user ?? 0)
        const c = Number(b.fady_commission_barber ?? 0)
        return acc + Math.max(0, t - u - c)
      }, 0)
      setPendingTotal(total)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            Virements coiffeurs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Historique des transferts Stripe Connect (déclenchés par le cron weekly-payouts).
          </p>
        </div>
        <Button onClick={() => void load()} variant="outline" size="sm" disabled={loading}>
          <RotateCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Virements ce mois-ci</CardDescription>
              <CardTitle>{logs.filter(l => l.payout_status === 'paid' && new Date(l.date_virement).getMonth() === new Date().getMonth()).length}</CardTitle>
            </CardHeader>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Éligible au prochain virement</CardDescription>
              <CardTitle>{pendingTotal.toFixed(2)} €</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Carte, complété, fonds disponibles, RDV terminé depuis 48h.</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total versé (100 derniers)</CardDescription>
              <CardTitle>{logs.filter(l => l.payout_status === 'paid').reduce((s, l) => s + Number(l.amount), 0).toFixed(2)} €</CardTitle>
            </CardHeader>
          </Card>
        </motion.div>
      </div>

      <div className="flex gap-2">
        {(['all', 'paid', 'pending', 'failed', 'refunded'] as const).map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'Tous' : STATUS_LABEL[s].label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Historique des virements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun virement à afficher.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Coiffeur</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Stripe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.date_virement).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                    <TableCell>{log.hairdresser?.name ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium">{Number(log.amount).toFixed(2)} €</TableCell>
                    <TableCell className="text-center">{log.bookings_count}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABEL[log.payout_status].tone}>
                        {STATUS_LABEL[log.payout_status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.stripe_transfer_id ? (
                        <a
                          href={`https://dashboard.stripe.com/transfers/${log.stripe_transfer_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-xs text-primary hover:underline"
                        >
                          {log.stripe_transfer_id.slice(0, 14)}…
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
