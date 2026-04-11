'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { fetchAllPaginated } from '@/lib/supabase/pagination'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { motion } from 'framer-motion'
import { FileCheck, Eye, CheckCircle, XCircle, Search, Filter, GraduationCap, Briefcase, FileText } from 'lucide-react'
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
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedDiploma, setSelectedDiploma] = useState<DiplomaVerification | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    fetchDiplomas()
  }, [])

  useEffect(() => {
    filterDiplomas()
  }, [diplomas, searchTerm, statusFilter, typeFilter])

  // Revenir à la page 1 quand les filtres changent
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, typeFilter, pageSize])

  // Sous-ensemble paginé à afficher
  const paginatedDiplomas = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredDiplomas.slice(start, start + pageSize)
  }, [filteredDiplomas, currentPage, pageSize])

  const fetchDiplomas = async () => {
    try {
      // Pagination pour contourner la limite de 1000 lignes
      const data = await fetchAllPaginated<DiplomaVerification>((from, to) =>
        supabase
          .from('hairdresser_diploma_verification')
          .select(`
            *,
            hairdresser:hairdressers(*)
          `)
          .order('created_at', { ascending: false })
          .range(from, to)
      )
      setDiplomas(data)
    } catch (error) {
      console.error('Erreur lors du chargement des diplômes:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterDiplomas = () => {
    let filtered = diplomas

    if (searchTerm) {
      filtered = filtered.filter(diploma =>
        diploma.hairdresser.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        diploma.hairdresser.phone?.includes(searchTerm)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(diploma => diploma.verification_status === statusFilter)
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(diploma => diploma.verification_type === typeFilter)
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

      const diploma = diplomas.find(d => d.id === diplomaId)
      if (diploma) {
        await supabase
          .from('hairdressers')
          .update({ statut: 'Diplomé' })
          .eq('id', diploma.hairdresser_id)

        if (diploma.hairdresser.user_id) {
          try {
            await sendHairdresserNotification(
              NotificationTemplates.diplomaApproved(diploma.hairdresser.user_id)
            )
            console.log('✅ Notification envoyée au coiffeur pour approbation du diplôme')
          } catch (notifError) {
            console.error('❌ Erreur lors de l\'envoi de la notification:', notifError)
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

      const diploma = diplomas.find(d => d.id === diplomaId)
      if (diploma && diploma.hairdresser.user_id) {
        try {
          await sendHairdresserNotification(
            NotificationTemplates.diplomaRejected(diploma.hairdresser.user_id, rejectionReason)
          )
          console.log('✅ Notification envoyée au coiffeur pour rejet du diplôme')
        } catch (notifError) {
          console.error('❌ Erreur lors de l\'envoi de la notification:', notifError)
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
      case 'notsubmit':
        return <Badge variant="outline">Non soumis</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'diploma':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <GraduationCap className="w-3 h-3 mr-1" />
            Diplôme
          </Badge>
        )
      case 'experience':
        return (
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            <Briefcase className="w-3 h-3 mr-1" />
            Expérience
          </Badge>
        )
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const getAllFileUrls = (diploma: DiplomaVerification): string[] => {
    const urls: string[] = []
    if (diploma.diploma_file_url) {
      urls.push(diploma.diploma_file_url)
    }
    if (diploma.experience_file_urls && diploma.experience_file_urls.length > 0) {
      urls.push(...diploma.experience_file_urls)
    }
    return urls
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
        <p className="text-muted-foreground">Vérification et validation des diplômes et justificatifs d&apos;expérience des coiffeurs</p>
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <GraduationCap className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type de vérification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="diploma">Diplôme</SelectItem>
                <SelectItem value="experience">Expérience</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="notsubmit">Non soumis</SelectItem>
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
            Liste des diplômes et justificatifs soumis par les coiffeurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coiffeur</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fichiers</TableHead>
                  <TableHead>Date de soumission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Attestation acceptée</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDiplomas.map((diploma) => {
                  const fileCount = getAllFileUrls(diploma).length
                  return (
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
                      <TableCell>{getTypeBadge(diploma.verification_type)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {fileCount} fichier{fileCount > 1 ? 's' : ''}
                        </span>
                      </TableCell>
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
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Détails de la vérification</DialogTitle>
                              <DialogDescription>
                                Informations du coiffeur et fichiers soumis
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

                                {/* Type de vérification */}
                                <div>
                                  <label className="text-sm font-medium">Type de vérification</label>
                                  <div className="mt-1">
                                    {getTypeBadge(selectedDiploma.verification_type)}
                                  </div>
                                </div>

                                {/* Fichier principal (diplôme) */}
                                {selectedDiploma.diploma_file_url && (
                                  <div>
                                    <label className="text-sm font-medium">Fichier de diplôme</label>
                                    <div className="mt-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => window.open(selectedDiploma.diploma_file_url!, '_blank')}
                                        className="w-full"
                                      >
                                        <GraduationCap className="w-4 h-4 mr-2" />
                                        Ouvrir le diplôme
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Fichiers d'expérience */}
                                {selectedDiploma.experience_file_urls && selectedDiploma.experience_file_urls.length > 0 && (
                                  <div>
                                    <label className="text-sm font-medium">
                                      Justificatifs d&apos;expérience ({selectedDiploma.experience_file_urls.length} fichier{selectedDiploma.experience_file_urls.length > 1 ? 's' : ''})
                                    </label>
                                    <div className="mt-2 space-y-2">
                                      {selectedDiploma.experience_file_urls.map((url, index) => (
                                        <Button
                                          key={index}
                                          variant="outline"
                                          onClick={() => window.open(url, '_blank')}
                                          className="w-full"
                                        >
                                          <FileText className="w-4 h-4 mr-2" />
                                          Fichier {index + 1}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Aucun fichier */}
                                {!selectedDiploma.diploma_file_url && (!selectedDiploma.experience_file_urls || selectedDiploma.experience_file_urls.length === 0) && (
                                  <div>
                                    <label className="text-sm font-medium">Fichiers</label>
                                    <p className="text-sm text-muted-foreground mt-2">Aucun fichier disponible</p>
                                  </div>
                                )}

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

                                {selectedDiploma.verification_status === 'pending' && (
                                  <div>
                                    <label className="text-sm font-medium">Raison du rejet (obligatoire pour rejeter)</label>
                                    <Input
                                      placeholder="Ex: Document illisible, diplôme non reconnu..."
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      className="mt-1"
                                    />
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
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {filteredDiplomas.length === 0 && (
            <div className="text-center py-8">
              <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune demande de vérification trouvée</p>
            </div>
          )}

          {filteredDiplomas.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredDiplomas.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
