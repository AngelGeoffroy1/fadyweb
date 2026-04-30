'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Users, Scissors, Calendar, DollarSign, FileCheck, Clock, Info } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

interface DashboardStats {
  totalUsers: number
  totalHairdressers: number
  totalBookings: number
  totalRevenue: number
  pendingDiplomas: number
  verifiedDiplomas: number
  monthlyStats: Array<{
    month: string
    users: number
    hairdressers: number
    bookings: number
    revenue: number
  }>
  bookingStatusStats: Array<{
    status: string
    count: number
  }>
}

const COLORS = ['#bd38fc', '#a020e8', '#8615d4', '#6d0fc0', '#5a0ca3', '#7c3aed', '#9333ea']

function KpiInfoButton({ label }: { label: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Afficher le calcul du KPI"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Info className="size-4" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-8 z-20 w-72 max-w-[calc(100vw-3rem)] rounded-md border bg-popover px-3 py-2 text-left text-xs leading-relaxed text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Mémoïser le client Supabase pour éviter les re-créations
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke<DashboardStats>('admin-dashboard-stats')

        if (error) {
          throw error
        }

        setStats(data)
      } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="h-32 bg-muted rounded-lg"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return null

  const kpiCards = [
    {
      title: 'Utilisateurs',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-[#bd38fc]',
      bgColor: 'bg-[#bd38fc]/10',
      tooltip: 'Nombre total de lignes dans la table users. Le calcul est fait côté Edge Function admin pour éviter les limites et restrictions RLS du navigateur.',
    },
    {
      title: 'Coiffeurs',
      value: stats.totalHairdressers,
      icon: Scissors,
      color: 'text-[#a020e8]',
      bgColor: 'bg-[#a020e8]/10',
      tooltip: 'Nombre total de lignes dans la table hairdressers. Le calcul utilise le count global côté serveur admin.',
    },
    {
      title: 'Réservations',
      value: stats.totalBookings,
      icon: Calendar,
      color: 'text-[#8615d4]',
      bgColor: 'bg-[#8615d4]/10',
      tooltip: 'Nombre total de réservations dans bookings, tous statuts confondus : pending, confirmed, completed, cancelled, refund, past et en_cours.',
    },
    {
      title: 'Revenus FADY',
      value: `${stats.totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`,
      icon: DollarSign,
      color: 'text-[#6d0fc0]',
      bgColor: 'bg-[#6d0fc0]/10',
      tooltip: 'Somme de fady_commission_user + fady_commission_barber pour les réservations carte non annulées/non remboursées, avec un canal et une date de disponibilité des fonds.',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de la plateforme Fady</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                      <KpiInfoButton label={card.tooltip} />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${card.bgColor}`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Diplomas Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileCheck className="w-5 h-5" />
                <span>Vérification des diplômes</span>
              </CardTitle>
              <CardDescription>Statut des demandes de vérification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Statistiques principales */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-[#F59E0B]" />
                    <span>En attente</span>
                  </div>
                  <Badge variant="secondary" className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20">{stats.pendingDiplomas}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-[#bd38fc]" />
                    <span>Vérifiés</span>
                  </div>
                  <Badge variant="default" className="bg-[#bd38fc] text-white">{stats.verifiedDiplomas}</Badge>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Taux de vérification</span>
                  <span>{stats.pendingDiplomas + stats.verifiedDiplomas > 0 ? Math.round((stats.verifiedDiplomas / (stats.pendingDiplomas + stats.verifiedDiplomas)) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#bd38fc] h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.pendingDiplomas + stats.verifiedDiplomas > 0 ? (stats.verifiedDiplomas / (stats.pendingDiplomas + stats.verifiedDiplomas)) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Statistiques supplémentaires */}
              <div className="pt-2 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-[#bd38fc]">{stats.verifiedDiplomas}</div>
                    <div className="text-xs text-muted-foreground">Approuvés</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#F59E0B]">{stats.pendingDiplomas}</div>
                    <div className="text-xs text-muted-foreground">En cours</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Réservations par statut</CardTitle>
              <CardDescription>Répartition des réservations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie
                      data={stats.bookingStatusStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.bookingStatusStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {stats.bookingStatusStats.map((entry, index) => (
                    <div key={entry.status} className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {entry.status}: {entry.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Évolution mensuelle</CardTitle>
              <CardDescription>Croissance des utilisateurs et coiffeurs</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="users" stroke="#bd38fc" strokeWidth={3} name="Utilisateurs" />
                  <Line type="monotone" dataKey="hairdressers" stroke="#a020e8" strokeWidth={3} name="Coiffeurs" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Revenus mensuels</CardTitle>
              <CardDescription>Évolution des revenus FADY</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} €`, 'Revenus FADY']} />
                  <Bar dataKey="revenue" fill="#bd38fc" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
