'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Settings, Percent, Save, ArrowLeft, TrendingUp } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type SubscriptionFee = Database['public']['Tables']['subscription_fees']['Row']

export default function SubscriptionFeesPage() {
  const [fees, setFees] = useState<SubscriptionFee[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [editedFees, setEditedFees] = useState<Map<string, number>>(new Map())
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    fetchFees()
  }, [])

  const fetchFees = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_fees')
        .select('*')
        .order('subscription_type', { ascending: true })

      if (error) throw error

      setFees(data || [])

      // Initialiser les valeurs éditées
      const initialEditedFees = new Map()
      data?.forEach(fee => {
        initialEditedFees.set(fee.id, Number(fee.commission_percentage))
      })
      setEditedFees(initialEditedFees)
    } catch (error) {
      console.error('Erreur lors du chargement des commissions:', error)
      toast.error('Erreur lors du chargement des commissions')
    } finally {
      setLoading(false)
    }
  }

  const handleFeeChange = (feeId: string, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setEditedFees(prev => new Map(prev).set(feeId, numValue))
    }
  }

  const updateFee = async (fee: SubscriptionFee) => {
    const newValue = editedFees.get(fee.id)

    if (newValue === undefined || newValue === Number(fee.commission_percentage)) {
      toast.info('Aucune modification à enregistrer')
      return
    }

    if (newValue < 0 || newValue > 100) {
      toast.error('Le pourcentage doit être entre 0 et 100')
      return
    }

    try {
      setUpdating(fee.id)

      const { error } = await supabase
        .from('subscription_fees')
        .update({
          commission_percentage: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', fee.id)

      if (error) throw error

      // Mettre à jour l'état local
      setFees(prev =>
        prev.map(f =>
          f.id === fee.id
            ? { ...f, commission_percentage: newValue.toString() as any }
            : f
        )
      )

      toast.success(`Commission mise à jour pour ${fee.subscription_type}`)
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      toast.error('Erreur lors de la mise à jour de la commission')
    } finally {
      setUpdating(null)
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'standard':
        return 'Standard'
      case 'boost':
        return 'Boost'
      case 'rookie':
        return 'Rookie'
      default:
        return type
    }
  }

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'standard':
        return 'Plan standard pour les coiffeurs établis'
      case 'boost':
        return 'Plan premium avec commission réduite'
      case 'rookie':
        return 'Plan pour les nouveaux coiffeurs'
      default:
        return 'Plan d\'abonnement'
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
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          <div className="h-48 bg-muted rounded animate-pulse" />
          <div className="h-48 bg-muted rounded animate-pulse" />
          <div className="h-48 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-4 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour</span>
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Configuration des commissions</h1>
          <p className="text-muted-foreground">Gérez les pourcentages de commission par type d'abonnement</p>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Information importante</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Les commissions définies ici s'appliquent à tous les abonnements du type correspondant.
            Les modifications prendront effet immédiatement pour les nouveaux calculs de commission.
          </p>
        </CardContent>
      </Card>

      {/* Fees Cards */}
      <div className="grid grid-cols-1 gap-4">
        {fees.map((fee) => (
          <motion.div
            key={fee.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Settings className="w-5 h-5" />
                      <span>{getTypeLabel(fee.subscription_type)}</span>
                      {getTypeBadge(fee.subscription_type)}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {getTypeDescription(fee.subscription_type)}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Dernière mise à jour</p>
                    <p className="text-sm font-medium">
                      {new Date(fee.updated_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-2 block">
                        Pourcentage de commission
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={editedFees.get(fee.id) ?? Number(fee.commission_percentage)}
                          onChange={(e) => handleFeeChange(fee.id, e.target.value)}
                          className="pr-12"
                          disabled={updating === fee.id}
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Percent className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Valeur entre 0 et 100
                      </p>
                    </div>
                    <Button
                      onClick={() => updateFee(fee)}
                      disabled={
                        updating === fee.id ||
                        editedFees.get(fee.id) === Number(fee.commission_percentage)
                      }
                      className="flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{updating === fee.id ? 'Enregistrement...' : 'Enregistrer'}</span>
                    </Button>
                  </div>

                  {/* Preview */}
                  <div className="bg-muted/50 rounded-lg p-4 border border-border">
                    <p className="text-sm text-muted-foreground mb-2">Aperçu</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Prix service (exemple)</span>
                        <span className="font-medium">50,00 €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Commission Fady ({editedFees.get(fee.id) ?? Number(fee.commission_percentage)}%)</span>
                        <span className="font-medium text-red-600">
                          -{((editedFees.get(fee.id) ?? Number(fee.commission_percentage)) * 50 / 100).toFixed(2)} €
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Revenu coiffeur</span>
                        <span className="text-green-600">
                          {(50 - ((editedFees.get(fee.id) ?? Number(fee.commission_percentage)) * 50 / 100)).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {fees.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune configuration de commission trouvée</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
