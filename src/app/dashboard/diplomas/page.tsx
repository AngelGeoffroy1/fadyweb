'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { motion } from 'framer-motion'
import { FileCheck, Eye, CheckCircle, XCircle, Search, Filter } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { sendHairdresserNotification, NotificationTemplates } from '@/lib/notifications'

type DiplomaVerification = Database['public']['Tables']['hairdresser_diploma_verification']['Row'] & {
  hairdresser: Database['public']['Tables']['hairdressers']['Row']
}

export default function DiplomasPage() {
  const [diplomas, setDiplomas] = useState<DiplomaVerification[]>([])
  const [filteredDiplomas, setFilteredDiplomas] = useState<DiplomaVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedDiploma, setSelectedDiploma] = useState<DiplomaVerification | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchDiplomas()
  }, [])

  useEffect(() => {
    filterDiplomas()
  }, [diplomas, searchTerm, statusFilter])

  const fetchDiplomas = async () => {
    try {
      const { data, error } = await supabase
        .from('hairdresser_diploma_verification')
        .select(`
          *,
          hairdresser:hairdressers(*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDiplomas(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des diplômes:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterDiplomas = () => {
    let filtered = diplomas

    // Filtre par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(diploma =>
        diploma.hairdresser.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        diploma.hairdresser.phone?.includes(searchTerm)
      )
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(diploma => diploma.verification_status === statusFilter)
    }

    setFilteredDiplomas(filtered)
  }

  const handleApprove = async (diplomaId: string) => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('hairdresser_diploma_verification')
        .update({
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
          rejection_reason: null
        })
        .eq('id', diplomaId)

      if (error) throw error

      // Mettre à jour le statut du coiffeur
      const diploma = diplomas.find(d => d.id === diplomaId)
      if (diploma) {
        await supabase
          .from('hairdressers')
          .update({ statut: 'Diplomé' })
          .eq('id', diploma.hairdresser_id)

        // Envoyer une notification au coiffeur
        if (diploma.hairdresser.user_id) {
          try {
            await sendHairdresserNotification(
              NotificationTemplates.diplomaApproved(diploma.hairdresser.user_id)
            )
            console.log('✅ Notification envoyée au coiffeur pour approbation du diplôme')
          } catch (notifError) {
            console.error('❌ Erreur lors de l\'envoi de la notification:', notifError)
            // Ne pas bloquer le processus si la notification échoue
          }
        }
      }

      await fetchDiplomas()
      setSelectedDiploma(null)
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (diplomaId: string) => {
    if (!rejectionReason.trim()) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('hairdresser_diploma_verification')
        .update({
          verification_status: 'rejected',
          rejection_reason: rejectionReason
        })
        .eq('id', diplomaId)

      if (error) throw error

      // Envoyer une notification au coiffeur
      const diploma = diplomas.find(d => d.id === diplomaId)
      if (diploma && diploma.hairdresser.user_id) {
        try {
          await sendHairdresserNotification(
            NotificationTemplates.diplomaRejected(diploma.hairdresser.user_id, rejectionReason)
          )
          console.log('✅ Notification envoyée au coiffeur pour rejet du diplôme')
        } catch (notifError) {
          console.error('❌ Erreur lors de l\'envoi de la notification:', notifError)
          // Ne pas bloquer le processus si la notification échoue
        }
      }

      await fetchDiplomas()
      setSelectedDiploma(null)
      setRejectionReason('')
    } catch (error) {
      console.error('Erreur lors du rejet:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">En attente</Badge>
      case 'verified':
        return <Badge variant="default" className="bg-green-100 text-green-800">Vérifié</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejeté</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestion des diplômes</h1>
        <p className="text-muted-foreground">Vérification et validation des diplômes des coiffeurs</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Rechercher par nom ou téléphone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="verified">Vérifiés</SelectItem>
                <SelectItem value="rejected">Rejetés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Diplomas Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5" />
            <span>Demandes de vérification ({filteredDiplomas.length})</span>
          </CardTitle>
          <CardDescription>
            Liste des diplômes soumis par les coiffeurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coiffeur</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Date de soumission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Attestation acceptée</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDiplomas.map((diploma) => (
                  <motion.tr
                    key={diploma.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell className="font-medium">
                      {diploma.hairdresser.name}
                    </TableCell>
                    <TableCell>{diploma.hairdresser.phone || 'N/A'}</TableCell>
                    <TableCell>
                      {diploma.submitted_at ? new Date(diploma.submitted_at).toLocaleDateString('fr-FR') : 'N/A'}
                    </TableCell>
                    <TableCell>{getStatusBadge(diploma.verification_status)}</TableCell>
                    <TableCell>
                      {diploma.has_accepted_attestation ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">Oui</Badge>
                      ) : (
                        <Badge variant="outline">Non</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDiploma(diploma)}
                            className="transition-all duration-200 hover:scale-105"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Voir
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Détails du diplôme</DialogTitle>
                            <DialogDescription>
                              Informations du coiffeur et fichier de diplôme
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedDiploma && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Nom du coiffeur</label>
                                  <p className="text-sm text-muted-foreground">{selectedDiploma.hairdresser.name}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Téléphone</label>
                                  <p className="text-sm text-muted-foreground">{selectedDiploma.hairdresser.phone || 'N/A'}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Email</label>
                                  <p className="text-sm text-muted-foreground">{selectedDiploma.hairdresser.user_id}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Statut actuel</label>
                                  <p className="text-sm">{selectedDiploma.hairdresser.statut}</p>
                                </div>
                              </div>

                              <div>
                                <label className="text-sm font-medium">Fichier de diplôme</label>
                                {selectedDiploma.diploma_file_url ? (
                                  <div className="mt-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => window.open(selectedDiploma.diploma_file_url!, '_blank')}
                                      className="w-full"
                                    >
                                      <FileCheck className="w-4 h-4 mr-2" />
                                      Ouvrir le PDF
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground mt-2">Aucun fichier disponible</p>
                                )}
                              </div>

                              <div>
                                <label className="text-sm font-medium">Attestation acceptée</label>
                                <p className="text-sm text-muted-foreground">
                                  {selectedDiploma.has_accepted_attestation ? 'Oui' : 'Non'}
                                </p>
                              </div>

                              {selectedDiploma.rejection_reason && (
                                <div>
                                  <label className="text-sm font-medium">Raison du rejet</label>
                                  <p className="text-sm text-muted-foreground">{selectedDiploma.rejection_reason}</p>
                                </div>
                              )}
                            </div>
                          )}

                          <DialogFooter className="flex-col sm:flex-row gap-2">
                            {selectedDiploma?.verification_status === 'pending' && (
                              <>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleReject(selectedDiploma.id)}
                                  disabled={actionLoading || !rejectionReason.trim()}
                                  className="transition-all duration-200 hover:scale-105"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Rejeter
                                </Button>
                                <Button
                                  onClick={() => handleApprove(selectedDiploma.id)}
                                  disabled={actionLoading}
                                  className="transition-all duration-200 hover:scale-105"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approuver
                                </Button>
                              </>
                            )}
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredDiplomas.length === 0 && (
            <div className="text-center py-8">
              <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune demande de vérification trouvée</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Reason Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <div className="hidden" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raison du rejet</DialogTitle>
            <DialogDescription>
              Veuillez indiquer la raison du rejet de ce diplôme
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Raison</label>
              <Input
                placeholder="Ex: Document illisible, diplôme non reconnu..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => selectedDiploma && handleReject(selectedDiploma.id)}
              disabled={actionLoading || !rejectionReason.trim()}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
