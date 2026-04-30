'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Smartphone, Save, AlertCircle, CheckCircle2, Scissors, Briefcase, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type AppIdentifier = 'fady' | 'fady_pro'

type AppVersion = {
  id: string
  app_identifier: AppIdentifier
  minimum_version: string
  latest_version: string
  force_update: boolean
  update_message: string
  app_store_url: string
  created_at: string
  updated_at: string
}

type FormState = {
  minimum_version: string
  latest_version: string
  force_update: boolean
  update_message: string
  app_store_url: string
}

const APP_LABELS: Record<AppIdentifier, { title: string; subtitle: string; icon: typeof Scissors }> = {
  fady: {
    title: 'Fady (Client)',
    subtitle: "App grand public utilisée par les clients pour réserver",
    icon: Scissors,
  },
  fady_pro: {
    title: 'Fady Pro',
    subtitle: "App professionnelle utilisée par les coiffeurs",
    icon: Briefcase,
  },
}

const EMPTY_FORM: FormState = {
  minimum_version: '',
  latest_version: '',
  force_update: false,
  update_message: '',
  app_store_url: '',
}

export default function AppVersionPage() {
  const [activeApp, setActiveApp] = useState<AppIdentifier>('fady')
  const [versions, setVersions] = useState<Record<AppIdentifier, AppVersion | null>>({
    fady: null,
    fady_pro: null,
  })
  const [forms, setForms] = useState<Record<AppIdentifier, FormState>>({
    fady: EMPTY_FORM,
    fady_pro: EMPTY_FORM,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingLive, setFetchingLive] = useState<AppIdentifier | null>(null)
  const [liveVersions, setLiveVersions] = useState<Record<AppIdentifier, string | null>>({
    fady: null,
    fady_pro: null,
  })
  const supabase = useMemo(() => createClient(), [])

  const fetchVersions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_version')
        .select('*')
        .in('app_identifier', ['fady', 'fady_pro'])

      if (error) throw error

      const byApp: Record<AppIdentifier, AppVersion | null> = { fady: null, fady_pro: null }
      const byForm: Record<AppIdentifier, FormState> = { fady: EMPTY_FORM, fady_pro: EMPTY_FORM }

      for (const row of (data ?? []) as AppVersion[]) {
        byApp[row.app_identifier] = row
        byForm[row.app_identifier] = {
          minimum_version: row.minimum_version || '',
          latest_version: row.latest_version || '',
          force_update: row.force_update || false,
          update_message: row.update_message || '',
          app_store_url: row.app_store_url || '',
        }
      }

      setVersions(byApp)
      setForms(byForm)
    } catch (error) {
      console.error('Erreur lors du chargement des versions:', error)
      toast.error("Erreur lors du chargement des versions de l'application")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  const updateForm = (app: AppIdentifier, partial: Partial<FormState>) => {
    setForms((prev) => ({ ...prev, [app]: { ...prev[app], ...partial } }))
  }

  // Extrait l'App Store ID numérique depuis l'URL (ex: .../id6754072839 -> "6754072839")
  const extractAppStoreId = (url: string): string | null => {
    const match = url.match(/\/id(\d+)/)
    return match ? match[1] : null
  }

  // Récupère la version actuellement publiée sur l'App Store via l'API iTunes Lookup
  const fetchLiveVersion = async (app: AppIdentifier) => {
    const url = forms[app].app_store_url
    const appStoreId = extractAppStoreId(url)
    if (!appStoreId) {
      toast.error("URL App Store invalide — impossible d'extraire l'ID")
      return
    }

    setFetchingLive(app)
    try {
      const cacheBuster = Date.now()
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${appStoreId}&country=fr&t=${cacheBuster}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const result = data.results?.[0]
      const liveVersion = result?.version as string | undefined
      if (!liveVersion) {
        toast.error("Aucune version trouvée sur l'App Store pour cet ID")
        return
      }
      setLiveVersions((prev) => ({ ...prev, [app]: liveVersion }))
      updateForm(app, { latest_version: liveVersion })
      toast.success(`Version récupérée depuis l'App Store : ${liveVersion}`)
    } catch (error) {
      console.error('Erreur fetch App Store:', error)
      toast.error("Impossible de récupérer la version depuis l'App Store")
    } finally {
      setFetchingLive(null)
    }
  }

  const handleSave = async (app: AppIdentifier) => {
    const current = versions[app]
    const formData = forms[app]
    if (!current) {
      toast.error("Aucune ligne en base pour cette app")
      return
    }

    if (!formData.minimum_version || !formData.latest_version) {
      toast.error('Les versions minimale et dernière sont requises')
      return
    }

    const versionRegex = /^\d+\.\d+\.\d+$/
    if (!versionRegex.test(formData.minimum_version) || !versionRegex.test(formData.latest_version)) {
      toast.error('Le format de version doit être X.X.X (ex: 1.0.0)')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('app_version')
        .update({
          minimum_version: formData.minimum_version,
          latest_version: formData.latest_version,
          force_update: formData.force_update,
          update_message: formData.update_message,
          app_store_url: formData.app_store_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', current.id)

      if (error) throw error

      toast.success(`Version de ${APP_LABELS[app].title} mise à jour avec succès`)
      await fetchVersions()
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      toast.error('Erreur lors de la mise à jour de la version')
    } finally {
      setSaving(false)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des versions des applications</h1>
          <p className="text-muted-foreground">Contrôlez les versions minimales et forcez les mises à jour pour Fady et Fady Pro</p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Information importante</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Chaque app (Fady client et Fady Pro) a sa propre configuration. La version minimale définit la version
                en dessous de laquelle l'app ne fonctionnera pas (popup non‑dismissable). Activer "Forcer la mise à jour"
                oblige tous les utilisateurs à installer la dernière version, même si la leur est ≥ minimum.
                Les apps re‑vérifient à chaque retour d'arrière‑plan (avec un throttle de 5 minutes).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeApp} onValueChange={(v) => setActiveApp(v as AppIdentifier)} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          {(['fady', 'fady_pro'] as AppIdentifier[]).map((app) => {
            const Icon = APP_LABELS[app].icon
            return (
              <TabsTrigger key={app} value={app} className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span>{APP_LABELS[app].title}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {(['fady', 'fady_pro'] as AppIdentifier[]).map((app) => {
          const current = versions[app]
          const formData = forms[app]
          return (
            <TabsContent key={app} value={app} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5" />
                    <span>{APP_LABELS[app].title}</span>
                  </CardTitle>
                  <CardDescription>
                    {APP_LABELS[app].subtitle}
                    <br />
                    Dernière mise à jour : {current ? new Date(current.updated_at).toLocaleString('fr-FR') : 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Version Numbers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor={`minimum_version_${app}`}>
                        Version minimale requise <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`minimum_version_${app}`}
                        placeholder="1.0.0"
                        value={formData.minimum_version}
                        onChange={(e) => updateForm(app, { minimum_version: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Les utilisateurs avec une version inférieure seront bloqués jusqu'à la mise à jour
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`latest_version_${app}`}>
                        Dernière version disponible <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`latest_version_${app}`}
                          placeholder="1.0.6"
                          value={formData.latest_version}
                          onChange={(e) => updateForm(app, { latest_version: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fetchLiveVersion(app)}
                          disabled={fetchingLive === app || !formData.app_store_url}
                          title="Récupérer la version actuellement publiée sur l'App Store"
                        >
                          {fetchingLive === app ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span className="ml-2 hidden sm:inline">Récupérer</span>
                        </Button>
                      </div>
                      {liveVersions[app] && (
                        <p
                          className={`text-xs ${
                            liveVersions[app] === formData.latest_version
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {liveVersions[app] === formData.latest_version
                            ? `✓ Synchronisé avec l'App Store (${liveVersions[app]})`
                            : `⚠ Version publiée sur l'App Store : ${liveVersions[app]}`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Version actuelle disponible sur l'App Store. Cliquez sur « Récupérer » pour la synchroniser automatiquement.
                      </p>
                    </div>
                  </div>

                  {/* Force Update Switch */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor={`force_update_${app}`} className="text-base">
                        Forcer la mise à jour
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Oblige tous les utilisateurs à installer la dernière version (popup bloquante)
                      </p>
                    </div>
                    <Switch
                      id={`force_update_${app}`}
                      checked={formData.force_update}
                      onCheckedChange={(checked) => updateForm(app, { force_update: checked })}
                    />
                  </div>

                  {/* Update Message */}
                  <div className="space-y-2">
                    <Label htmlFor={`update_message_${app}`}>Message de mise à jour</Label>
                    <Textarea
                      id={`update_message_${app}`}
                      placeholder="Une nouvelle version de l'app est disponible..."
                      value={formData.update_message}
                      onChange={(e) => updateForm(app, { update_message: e.target.value })}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ce message sera affiché aux utilisateurs lorsqu'une mise à jour est disponible
                    </p>
                  </div>

                  {/* App Store URL */}
                  <div className="space-y-2">
                    <Label htmlFor={`app_store_url_${app}`}>URL de l'App Store</Label>
                    <Input
                      id={`app_store_url_${app}`}
                      placeholder="https://apps.apple.com/fr/app/..."
                      value={formData.app_store_url}
                      onChange={(e) => updateForm(app, { app_store_url: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Lien vers la page de l'application sur l'App Store</p>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={() => handleSave(app)}
                      disabled={saving}
                      className="transition-all duration-200 hover:scale-105"
                      size="lg"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer les modifications
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Current Status Card */}
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-green-900 dark:text-green-100">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>État actuel — {APP_LABELS[app].title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Version minimale</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">{current?.minimum_version}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Version actuelle</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">{current?.latest_version}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Mise à jour forcée</p>
                      <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                        {current?.force_update ? '✓ Activée' : '✗ Désactivée'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Dernière modification</p>
                      <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                        {current ? new Date(current.updated_at).toLocaleDateString('fr-FR') : 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
