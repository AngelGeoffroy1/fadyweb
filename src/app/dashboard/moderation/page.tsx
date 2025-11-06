'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react'

type BannedWord = {
  id: string
  word: string
  created_at: string
  created_by: string | null
}

export default function ModerationPage() {
  const supabase = useMemo(() => createClient(), [])
  const [bannedWords, setBannedWords] = useState<BannedWord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [wordsInput, setWordsInput] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    void fetchBannedWords()
  }, [])

  const fetchBannedWords = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('chat_banned_words')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const sanitizedData = data ?? []
      setBannedWords(sanitizedData)
      setSelectedIds((previous) => {
        const next = new Set<string>()
        const allowedIds = new Set(sanitizedData.map((item) => item.id))
        previous.forEach((id) => {
          if (allowedIds.has(id)) {
            next.add(id)
          }
        })
        return next
      })
    } catch (error) {
      console.error('Erreur lors du chargement des mots bannis :', error)
      toast.error('Impossible de charger la liste des mots bannis')
    } finally {
      setLoading(false)
    }
  }

  const handleAddWords = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedWords = Array.from(
      new Set(
        wordsInput
          .split(/[\n,]+/)
          .map((word) => word.trim().toLowerCase())
          .filter(Boolean)
      )
    )

    if (parsedWords.length === 0) {
      toast.error('Veuillez saisir au moins un mot à bannir')
      return
    }

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const payload = parsedWords.map((word) => ({
        word,
        created_by: user?.id ?? null,
      }))

      const { data, error } = await supabase
        .from('chat_banned_words')
        .insert(payload, { onConflict: 'word', ignoreDuplicates: true })
        .select('word')

      if (error) {
        throw error
      }

      const insertedCount = data?.length ?? 0
      const alreadyPresent = parsedWords.length - insertedCount

      if (insertedCount > 0) {
        toast.success(
          insertedCount === 1
            ? '1 mot a été ajouté à la liste bannie'
            : `${insertedCount} mots ont été ajoutés à la liste bannie`
        )
      }

      if (alreadyPresent > 0) {
        toast.info(
          alreadyPresent === 1
            ? "1 mot était déjà présent et n'a pas été ajouté de nouveau"
            : `${alreadyPresent} mots étaient déjà présents et n'ont pas été ajoutés de nouveau`
        )
      }

      setWordsInput('')
      await fetchBannedWords()
    } catch (error) {
      console.error('Erreur lors de l\'ajout des mots bannis :', error)
      toast.error('Impossible d\'ajouter ces mots pour le moment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteWord = async (wordId: string, word: string) => {
    if (!confirm(`Supprimer « ${word} » de la liste des mots bannis ?`)) {
      return
    }

    setDeletingId(wordId)

    try {
      const { error } = await supabase
        .from('chat_banned_words')
        .delete()
        .eq('id', wordId)

      if (error) {
        throw error
      }

      toast.success(`Le mot « ${word} » a été retiré de la liste`)
      await fetchBannedWords()
    } catch (error) {
      console.error('Erreur lors de la suppression du mot banni :', error)
      toast.error('Impossible de supprimer ce mot pour le moment')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleSelection = (wordId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(wordId)) {
        next.delete(wordId)
      } else {
        next.add(wordId)
      }
      return next
    })
  }

  const allSelected = bannedWords.length > 0 && selectedIds.size === bannedWords.length

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }

    setSelectedIds(new Set(bannedWords.map((item) => item.id)))
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      return
    }

    if (
      !confirm(
        selectedIds.size === 1
          ? 'Supprimer le mot sélectionné ?'
          : `Supprimer ${selectedIds.size} mots sélectionnés ?`
      )
    ) {
      return
    }

    setBulkDeleting(true)

    try {
      const idsToDelete = Array.from(selectedIds)

      const { error } = await supabase
        .from('chat_banned_words')
        .delete()
        .in('id', idsToDelete)

      if (error) {
        throw error
      }

      toast.success(
        idsToDelete.length === 1
          ? 'Le mot sélectionné a été supprimé'
          : `${idsToDelete.length} mots sélectionnés ont été supprimés`
      )

      setSelectedIds(new Set())
      await fetchBannedWords()
    } catch (error) {
      console.error('Erreur lors de la suppression groupée :', error)
      toast.error('Impossible de supprimer les mots sélectionnés pour le moment')
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Modération</h1>
          <p className="text-muted-foreground">
            Gérez la liste des mots bannis utilisés par la modération des chats iOS.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Chat moderation
          </CardTitle>
          <CardDescription>
            Ajoutez ou supprimez des mots bannis. La liste est appliquée automatiquement côté app iOS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddWords} className="space-y-3">
            <Textarea
              placeholder="Ajouter un ou plusieurs mots (séparés par des retours à la ligne ou des virgules)"
              value={wordsInput}
              onChange={(event) => setWordsInput(event.target.value)}
              disabled={submitting}
            />
            <p className="text-sm text-muted-foreground">
              Exemple : <span className="font-medium">mot1, mot2</span> ou chaque mot sur une nouvelle ligne.
            </p>
            <Button
              type="submit"
              disabled={submitting}
              className="sm:w-auto"
            >
              <span className="flex items-center gap-2">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {submitting ? 'Ajout...' : 'Ajouter'}
              </span>
            </Button>
          </form>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Card className="border-dashed border-foreground/10">
              <CardContent className="p-0">
                {bannedWords.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucun mot banni pour le moment
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={allSelected}
                          onChange={handleToggleAll}
                        />
                        <span className="text-sm text-muted-foreground">
                          {selectedIds.size > 0
                            ? `${selectedIds.size} mot(s) sélectionné(s)`
                            : 'Sélectionner tous'}
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleBulkDelete}
                        disabled={selectedIds.size === 0 || bulkDeleting}
                        className="transition-all duration-200 hover:scale-105"
                      >
                        {bulkDeleting ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Suppression...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            Supprimer la sélection
                          </span>
                        )}
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">&nbsp;</TableHead>
                          <TableHead>Mot</TableHead>
                          <TableHead>Ajouté le</TableHead>
                          <TableHead className="w-[120px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bannedWords.map((item) => {
                          const isSelected = selectedIds.has(item.id)
                          return (
                            <motion.tr
                              key={item.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{
                                opacity: 1,
                                y: 0,
                                scale: isSelected ? 1.02 : 1,
                              }}
                              transition={{
                                duration: 0.2,
                                scale: {
                                  type: 'spring',
                                  stiffness: 420,
                                  damping: 22,
                                },
                              }}
                              layout
                              className={isSelected ? 'bg-muted/40' : ''}
                            >
                              <TableCell>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelection(item.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-base font-medium">
                                  {item.word}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : '—'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteWord(item.id, item.word)}
                                  disabled={deletingId === item.id}
                                  className="transition-all duration-200 hover:scale-105 hover:bg-destructive hover:text-destructive-foreground"
                                >
                                  {deletingId === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </motion.tr>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

