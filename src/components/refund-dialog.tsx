'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { sendClientNotification, sendHairdresserNotification, NotificationTemplates } from '@/lib/notifications'
import { edgeFunctionUrls } from '@/lib/config'

interface RefundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  totalAmount: number
  commission: number
  commissionPercentage: number
  onRefundSuccess: () => void
}

export function RefundDialog({
  open,
  onOpenChange,
  bookingId,
  totalAmount,
  commission,
  commissionPercentage,
  onRefundSuccess,
}: RefundDialogProps) {
  const [refundAmount, setRefundAmount] = useState<string>(totalAmount.toString())
  const [commissionHandling, setCommissionHandling] = useState<'keep_platform_commission' | 'refund_all'>('keep_platform_commission')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculs en temps réel
  const parsedAmount = parseFloat(refundAmount) || 0
  const isFullRefund = parsedAmount === totalAmount
  const isPartialRefund = parsedAmount > 0 && parsedAmount < totalAmount

  let platformKept = 0
  let hairdresserReversed = 0
  let clientRefunded = parsedAmount

  if (commissionHandling === 'keep_platform_commission') {
    // Calculer la commission proportionnelle au montant remboursé
    const proportionalCommission = (parsedAmount * commissionPercentage) / 100
    platformKept = proportionalCommission
    hairdresserReversed = parsedAmount - proportionalCommission
  } else {
    platformKept = 0
    hairdresserReversed = parsedAmount
  }

  // Réinitialiser le montant quand le dialog s'ouvre
  useEffect(() => {
    if (open) {
      setRefundAmount(totalAmount.toString())
      setCommissionHandling('keep_platform_commission')
      setReason('')
      setError(null)
    }
  }, [open, totalAmount])

  const handleRefund = async () => {
    setLoading(true)
    setError(null)

    try {
      // Validation
      if (parsedAmount <= 0) {
        throw new Error('Le montant doit être supérieur à 0')
      }

      if (parsedAmount > totalAmount) {
        throw new Error('Le montant ne peut pas dépasser le montant total de la réservation')
      }

      // Créer le client Supabase et récupérer le token
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        throw new Error('Session expirée, veuillez vous reconnecter')
      }

      // Appeler l'Edge Function avec le bon token
      const response = await fetch(edgeFunctionUrls.refundPayment, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId,
          amount: parsedAmount,
          commissionHandling,
          reason: reason || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors du remboursement')
      }

      // Récupérer les informations de la réservation pour envoyer les notifications
      try {
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            id,
            user_id,
            hairdresser_id,
            booking_date,
            booking_time,
            hairdressers:hairdresser_id(user_id)
          `)
          .eq('id', bookingId)
          .single()

        if (bookingError) {
          console.error('Erreur lors de la récupération des infos de réservation:', bookingError)
        } else if (bookingData) {
          const bookingDate = new Date(bookingData.booking_date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
          const bookingDateTime = `${bookingDate} à ${bookingData.booking_time}`

          // Envoyer notification au client
          await sendClientNotification(
            NotificationTemplates.refundProcessedClient(
              bookingData.user_id,
              bookingData.id,
              parsedAmount
            )
          )
          console.log('✅ Notification de remboursement envoyée au client')

          // Envoyer notification au coiffeur si la commission est affectée
          if (hairdresserReversed > 0 && bookingData.hairdressers?.user_id) {
            await sendHairdresserNotification(
              NotificationTemplates.refundProcessedHairdresser(
                bookingData.hairdressers.user_id,
                bookingData.id,
                hairdresserReversed,
                bookingDateTime
              )
            )
            console.log('✅ Notification de remboursement envoyée au coiffeur')
          }
        }
      } catch (notifError) {
        console.error('❌ Erreur lors de l\'envoi des notifications de remboursement:', notifError)
        // Ne pas bloquer le processus si les notifications échouent
      }

      // Succès
      onRefundSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Rembourser le paiement</span>
          </DialogTitle>
          <DialogDescription>
            Configurez les paramètres du remboursement Stripe. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Montant total */}
          <div className="rounded-lg bg-muted/50 dark:bg-muted/20 p-3 border border-border">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Montant total de la réservation</span>
              <span className="font-semibold text-foreground">{totalAmount.toFixed(2)} €</span>
            </div>
          </div>

          {/* Montant à rembourser */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount" className="text-sm">Montant à rembourser (€)</Label>
            <Input
              id="refund-amount"
              type="number"
              min="0"
              max={totalAmount}
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder={totalAmount.toString()}
            />
          </div>

          {/* Gestion de la commission */}
          <div className="space-y-1.5">
            <Label htmlFor="commission-handling" className="text-sm">Gestion de la commission</Label>
            <Select value={commissionHandling} onValueChange={(value: any) => setCommissionHandling(value)}>
              <SelectTrigger id="commission-handling">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep_platform_commission">
                  Garder la commission Fady ({commissionPercentage}%)
                </SelectItem>
                <SelectItem value="refund_all">
                  Rembourser la commission aussi
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Raison */}
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-sm">Raison (optionnel)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Client insatisfait..."
              rows={2}
            />
          </div>

          {/* Récapitulatif calculé */}
          {parsedAmount > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 dark:bg-muted/10 p-3 space-y-2">
              <div className="font-semibold text-sm flex items-center space-x-2 text-foreground">
                <AlertCircle className="w-4 h-4" />
                <span>Récapitulatif</span>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant={isFullRefund ? 'default' : 'secondary'} className="text-xs">
                    {isFullRefund ? 'Complet' : 'Partiel'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center py-1.5 border-t border-border">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{clientRefunded.toFixed(2)} €</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Fady</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{platformKept.toFixed(2)} €</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Coiffeur</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{hairdresserReversed.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleRefund}
            disabled={loading || parsedAmount <= 0 || parsedAmount > totalAmount}
            variant="destructive"
          >
            {loading ? 'Remboursement en cours...' : `Rembourser ${parsedAmount.toFixed(2)} €`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
