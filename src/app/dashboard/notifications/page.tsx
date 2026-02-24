'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import { Checkbox } from '@/components/ui/checkbox'
import { Bell, Send, Users, Scissors, Search, Megaphone, Clock, CheckCircle, XCircle, Smartphone, ListFilter } from 'lucide-react'
import { sendClientNotification, sendHairdresserNotification, sendBroadcastNotification } from '@/lib/notifications'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { toast } from 'sonner'

interface NotificationLog {
  id: string
  title: string
  body: string
  target_type: string
  target_user_id: string | null
  target_user_name: string | null
  sent_count: number
  failed_count: number
  total_count: number
  sent_by: string
  data: any
  created_at: string
}

interface UserOption {
  id: string
  label: string
  type: 'client' | 'hairdresser'
  userId: string
}

interface BroadcastRecipient {
  userId: string
  name: string
  detail: string
  type: 'client' | 'hairdresser'
  checked: boolean
}

export default function NotificationsPage() {
  const { user } = useAdmin()
  const supabase = useMemo(() => createClient(), [])

  // Stats
  const [clientTokenCount, setClientTokenCount] = useState(0)
  const [proTokenCount, setProTokenCount] = useState(0)

  // Logs
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<NotificationLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logSearch, setLogSearch] = useState('')
  const [logFilter, setLogFilter] = useState('all')

  // Send form
  const [sendMode, setSendMode] = useState<'individual' | 'broadcast'>('individual')
  const [targetApp, setTargetApp] = useState<'client' | 'hairdresser'>('client')
  const [broadcastTarget, setBroadcastTarget] = useState<'all_clients' | 'all_hairdressers' | 'all'>('all_clients')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  // Individual user search
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<UserOption[]>([])
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [searchingUsers, setSearchingUsers] = useState(false)

  // Broadcast recipients modal
  const [recipientsOpen, setRecipientsOpen] = useState(false)
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(false)
  const [recipientSearch, setRecipientSearch] = useState('')

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isFetchingRef = useRef(false)

  useEffect(() => {
    fetchStats()
    fetchLogs()
  }, [])

  useEffect(() => {
    filterLogs()
  }, [logs, logSearch, logFilter])

  const fetchStats = async () => {
    const [clientTokens, proTokens] = await Promise.all([
      supabase.from('user_device_tokens').select('id', { count: 'exact', head: true }),
      supabase.from('fady_pro_device_tokens').select('id', { count: 'exact', head: true }),
    ])
    setClientTokenCount(clientTokens.count || 0)
    setProTokenCount(proTokens.count || 0)
  }

  const fetchLogs = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error('Erreur chargement logs:', error)
    } finally {
      setLogsLoading(false)
      isFetchingRef.current = false
    }
  }, [supabase])

  const filterLogs = () => {
    let filtered = logs

    if (logSearch) {
      const search = logSearch.toLowerCase()
      filtered = filtered.filter(log =>
        log.title.toLowerCase().includes(search) ||
        log.body.toLowerCase().includes(search) ||
        log.target_user_name?.toLowerCase().includes(search)
      )
    }

    if (logFilter !== 'all') {
      filtered = filtered.filter(log => log.target_type === logFilter)
    }

    setFilteredLogs(filtered)
  }

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUserResults([])
      return
    }

    setSearchingUsers(true)
    try {
      const results: UserOption[] = []

      if (targetApp === 'client') {
        const { data } = await supabase
          .from('users')
          .select('id, full_name, email')
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(10)

        if (data) {
          for (const u of data) {
            results.push({
              id: u.id,
              label: `${u.full_name || 'Sans nom'} (${u.email || 'Pas d\'email'})`,
              type: 'client',
              userId: u.id,
            })
          }
        }
      } else {
        const { data } = await supabase
          .from('hairdressers')
          .select('id, name, phone, user_id')
          .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(10)

        if (data) {
          for (const h of data) {
            if (h.user_id) {
              results.push({
                id: h.id,
                label: `${h.name} (${h.phone || 'Pas de tel'})`,
                type: 'hairdresser',
                userId: h.user_id,
              })
            }
          }
        }
      }

      setUserResults(results)
    } catch (error) {
      console.error('Erreur recherche users:', error)
    } finally {
      setSearchingUsers(false)
    }
  }, [supabase, targetApp])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(userSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch, searchUsers])

  // Reset selected user when changing target app
  useEffect(() => {
    setSelectedUser(null)
    setUserSearch('')
    setUserResults([])
  }, [targetApp])

  // Reset recipients when changing broadcast target
  useEffect(() => {
    setRecipients([])
  }, [broadcastTarget])

  const fetchRecipients = useCallback(async () => {
    setRecipientsLoading(true)
    try {
      const list: BroadcastRecipient[] = []

      if (broadcastTarget === 'all_clients' || broadcastTarget === 'all') {
        // Fetch clients who have device tokens
        const { data: tokens } = await supabase
          .from('user_device_tokens')
          .select('user_id')

        if (tokens && tokens.length > 0) {
          const uniqueUserIds = [...new Set(tokens.map(t => t.user_id))]
          const { data: users } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', uniqueUserIds)

          if (users) {
            for (const u of users) {
              list.push({
                userId: u.id,
                name: u.full_name || 'Sans nom',
                detail: u.email || '',
                type: 'client',
                checked: true,
              })
            }
          }
        }
      }

      if (broadcastTarget === 'all_hairdressers' || broadcastTarget === 'all') {
        const { data: tokens } = await supabase
          .from('fady_pro_device_tokens')
          .select('user_id')

        if (tokens && tokens.length > 0) {
          const uniqueUserIds = [...new Set(tokens.map(t => t.user_id))]
          const { data: hairdressers } = await supabase
            .from('hairdressers')
            .select('user_id, name, phone')
            .in('user_id', uniqueUserIds)

          if (hairdressers) {
            for (const h of hairdressers) {
              if (h.user_id) {
                list.push({
                  userId: h.user_id,
                  name: h.name,
                  detail: h.phone || '',
                  type: 'hairdresser',
                  checked: true,
                })
              }
            }
          }
        }
      }

      // Preserve existing check state if we already had recipients
      if (recipients.length > 0) {
        const prevState = new Map(recipients.map(r => [r.userId, r.checked]))
        for (const r of list) {
          if (prevState.has(r.userId)) {
            r.checked = prevState.get(r.userId)!
          }
        }
      }

      setRecipients(list)
    } catch (error) {
      console.error('Erreur chargement destinataires:', error)
      toast.error('Erreur lors du chargement des destinataires')
    } finally {
      setRecipientsLoading(false)
    }
  }, [supabase, broadcastTarget, recipients])

  const openRecipientsModal = () => {
    fetchRecipients()
    setRecipientSearch('')
    setRecipientsOpen(true)
  }

  const toggleRecipient = (userId: string) => {
    setRecipients(prev => prev.map(r =>
      r.userId === userId ? { ...r, checked: !r.checked } : r
    ))
  }

  const toggleAllRecipients = (checked: boolean) => {
    setRecipients(prev => prev.map(r => ({ ...r, checked })))
  }

  const filteredRecipients = recipients.filter(r => {
    if (!recipientSearch) return true
    const search = recipientSearch.toLowerCase()
    return r.name.toLowerCase().includes(search) || r.detail.toLowerCase().includes(search)
  })

  const checkedCount = recipients.filter(r => r.checked).length
  const hasExclusions = recipients.length > 0 && checkedCount < recipients.length

  const handleSend = async () => {
    setConfirmOpen(false)
    setSending(true)

    try {
      let result: { success: boolean; sent: number; failed: number; total: number }
      let targetType: string
      let targetUserId: string | null = null
      let targetUserName: string | null = null

      if (sendMode === 'individual') {
        if (!selectedUser) {
          toast.error('Veuillez sélectionner un utilisateur')
          setSending(false)
          return
        }

        targetUserId = selectedUser.userId
        targetUserName = selectedUser.label

        const params = {
          userId: selectedUser.userId,
          title,
          body,
          data: { type: 'general' as const },
        }

        if (selectedUser.type === 'client') {
          targetType = 'individual_client'
          result = await sendClientNotification(params)
        } else {
          targetType = 'individual_hairdresser'
          result = await sendHairdresserNotification(params)
        }
      } else {
        targetType = broadcastTarget

        // Si des destinataires ont été exclus, passer la liste des userIds sélectionnés
        const selectedUserIds = hasExclusions
          ? recipients.filter(r => r.checked).map(r => r.userId)
          : undefined

        result = await sendBroadcastNotification({
          title,
          body,
          target: broadcastTarget,
          data: { type: 'general' as const },
          userIds: selectedUserIds,
        })
      }

      // Log en base de données
      await supabase.from('notification_logs').insert({
        title,
        body,
        target_type: targetType,
        target_user_id: targetUserId,
        target_user_name: targetUserName,
        sent_count: result.sent,
        failed_count: result.failed,
        total_count: result.total,
        sent_by: user?.id || '',
        data: { type: 'general' },
      })

      if (result.sent > 0) {
        toast.success(`Notification envoyée avec succès (${result.sent}/${result.total})`)
      } else if (result.total === 0) {
        toast.warning('Aucun device token trouvé pour cette cible')
      } else {
        toast.error(`Échec de l'envoi (${result.failed}/${result.total} échoués)`)
      }

      // Reset form
      setTitle('')
      setBody('')
      setSelectedUser(null)
      setUserSearch('')
      fetchLogs()
    } catch (error: any) {
      console.error('Erreur envoi:', error)
      toast.error(error.message || 'Erreur lors de l\'envoi de la notification')
    } finally {
      setSending(false)
    }
  }

  const canSend = title.trim() && body.trim() && (sendMode === 'broadcast' || selectedUser)

  const getTargetBadge = (targetType: string) => {
    switch (targetType) {
      case 'individual_client':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Client</Badge>
      case 'individual_hairdresser':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Coiffeur</Badge>
      case 'all_clients':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Tous clients</Badge>
      case 'all_hairdressers':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Tous coiffeurs</Badge>
      case 'all':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Tout le monde</Badge>
      default:
        return <Badge variant="outline">{targetType}</Badge>
    }
  }

  const getResultBadge = (log: NotificationLog) => {
    if (log.sent_count > 0 && log.failed_count === 0) {
      return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Succès</Badge>
    }
    if (log.sent_count > 0 && log.failed_count > 0) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Partiel</Badge>
    }
    if (log.total_count === 0) {
      return <Badge variant="outline">Aucun token</Badge>
    }
    return <Badge variant="destructive">Échec</Badge>
  }

  if (logsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Notifications Push</h1>
        <p className="text-muted-foreground">Envoyez des notifications push aux utilisateurs de Fady</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Devices Clients</p>
                  <p className="text-2xl font-bold">{clientTokenCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Scissors className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Devices Coiffeurs</p>
                  <p className="text-2xl font-bold">{proTokenCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Bell className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Notifications envoyées</p>
                  <p className="text-2xl font-bold">{logs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Send Notification Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Send className="w-5 h-5" />
              <span>Envoyer une notification</span>
            </CardTitle>
            <CardDescription>
              Envoyez une notification push individuelle ou en masse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode selection */}
            <Tabs value={sendMode} onValueChange={(v) => setSendMode(v as 'individual' | 'broadcast')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="individual" className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Individuelle</span>
                </TabsTrigger>
                <TabsTrigger value="broadcast" className="flex items-center space-x-2">
                  <Megaphone className="w-4 h-4" />
                  <span>Broadcast</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="individual" className="space-y-4 mt-4">
                {/* Target app selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Application cible</label>
                  <Select value={targetApp} onValueChange={(v) => setTargetApp(v as 'client' | 'hairdresser')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Fady App (Clients)</SelectItem>
                      <SelectItem value="hairdresser">Fady Pro (Coiffeurs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* User search */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Rechercher un {targetApp === 'client' ? 'client' : 'coiffeur'}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder={targetApp === 'client'
                        ? 'Rechercher par nom ou email...'
                        : 'Rechercher par nom ou téléphone...'}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Search results */}
                  {userResults.length > 0 && !selectedUser && (
                    <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u)
                            setUserSearch('')
                            setUserResults([])
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm"
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {searchingUsers && (
                    <p className="text-sm text-muted-foreground mt-1">Recherche en cours...</p>
                  )}

                  {/* Selected user */}
                  {selectedUser && (
                    <div className="mt-2 flex items-center justify-between bg-muted rounded-lg px-3 py-2">
                      <span className="text-sm font-medium">{selectedUser.label}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(null)
                          setUserSearch('')
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="broadcast" className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Cible du broadcast</label>
                  <div className="flex gap-2">
                    <Select value={broadcastTarget} onValueChange={(v) => setBroadcastTarget(v as any)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_clients">Tous les clients ({clientTokenCount} devices)</SelectItem>
                        <SelectItem value="all_hairdressers">Tous les coiffeurs ({proTokenCount} devices)</SelectItem>
                        <SelectItem value="all">Tout le monde ({clientTokenCount + proTokenCount} devices)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={openRecipientsModal}
                      className="shrink-0"
                    >
                      <ListFilter className="w-4 h-4 mr-2" />
                      Destinataires
                    </Button>
                  </div>
                  {hasExclusions && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                      {checkedCount} / {recipients.length} destinataires sélectionnés
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Notification content */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium mb-2 block">Titre de la notification</label>
                <Input
                  placeholder="Ex: Nouveau service disponible !"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground mt-1">{title.length}/100</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea
                  placeholder="Ex: Découvrez nos nouveaux services de coiffure à domicile..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1">{body.length}/500</p>
              </div>

              {/* Preview */}
              {(title || body) && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-2">Aperçu de la notification</p>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                      <Bell className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{title || 'Titre...'}</p>
                      <p className="text-sm text-muted-foreground">{body || 'Message...'}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend || sending}
                className="w-full transition-all duration-200 hover:scale-[1.01]"
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Envoi en cours...' : 'Envoyer la notification'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'envoi</DialogTitle>
            <DialogDescription>
              {sendMode === 'individual'
                ? `Envoyer cette notification à ${selectedUser?.label} ?`
                : hasExclusions
                  ? `Envoyer cette notification à ${checkedCount} destinataire${checkedCount > 1 ? 's' : ''} sélectionné${checkedCount > 1 ? 's' : ''} ?`
                  : `Envoyer cette notification à ${
                      broadcastTarget === 'all_clients' ? `tous les clients (${clientTokenCount} devices)` :
                      broadcastTarget === 'all_hairdressers' ? `tous les coiffeurs (${proTokenCount} devices)` :
                      `tout le monde (${clientTokenCount + proTokenCount} devices)`
                    } ?`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-lg p-4 bg-muted/50">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-sm text-muted-foreground mt-1">{body}</p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Envoi...' : 'Confirmer l\'envoi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipients Modal */}
      <Dialog open={recipientsOpen} onOpenChange={setRecipientsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Destinataires du broadcast</span>
            </DialogTitle>
            <DialogDescription>
              Cochez ou décochez les utilisateurs pour personnaliser les destinataires
            </DialogDescription>
          </DialogHeader>

          {recipientsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Search + select all */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher un destinataire..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      checked={checkedCount === recipients.length}
                      onCheckedChange={(checked) => toggleAllRecipients(!!checked)}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Tout sélectionner
                    </label>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {checkedCount} / {recipients.length}
                  </span>
                </div>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-0 max-h-[400px]">
                {filteredRecipients.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {recipientSearch ? 'Aucun résultat' : 'Aucun destinataire trouvé'}
                  </div>
                ) : (
                  filteredRecipients.map((r) => (
                    <label
                      key={r.userId}
                      className="flex items-center space-x-3 px-3 py-2.5 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Checkbox
                        checked={r.checked}
                        onCheckedChange={() => toggleRecipient(r.userId)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium truncate">{r.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {r.type === 'client' ? 'Client' : 'Coiffeur'}
                          </Badge>
                        </div>
                        {r.detail && (
                          <p className="text-xs text-muted-foreground truncate">{r.detail}</p>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button onClick={() => setRecipientsOpen(false)}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Valider ({checkedCount} sélectionnés)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Historique des notifications ({filteredLogs.length})</span>
            </CardTitle>
            <CardDescription>
              Dernières notifications envoyées depuis le dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher dans l'historique..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={logFilter} onValueChange={setLogFilter}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Filtrer par type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="individual_client">Client individuel</SelectItem>
                  <SelectItem value="individual_hairdresser">Coiffeur individuel</SelectItem>
                  <SelectItem value="all_clients">Broadcast clients</SelectItem>
                  <SelectItem value="all_hairdressers">Broadcast coiffeurs</SelectItem>
                  <SelectItem value="all">Broadcast tous</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Résultat</TableHead>
                    <TableHead>Envoyées</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                      className="transition-colors"
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="font-medium max-w-[150px] truncate">
                        {log.title}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.body}
                      </TableCell>
                      <TableCell>{getTargetBadge(log.target_type)}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">
                        {log.target_user_name || '-'}
                      </TableCell>
                      <TableCell>{getResultBadge(log)}</TableCell>
                      <TableCell className="text-sm">
                        <span className="text-green-600 dark:text-green-400">{log.sent_count}</span>
                        {' / '}
                        <span>{log.total_count}</span>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredLogs.length === 0 && (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune notification envoyée pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
