'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { motion } from 'framer-motion'
import { Smartphone, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

type AppVersion = {
  id: string
  minimum_version: string
  latest_version: string
  force_update: boolean
  update_message: string
  app_store_url: string
  created_at: string
  updated_at: string
}

export default function AppVersionPage() {
  const [appVersion, setAppVersion] = useState<AppVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    minimum_version: '',
    latest_version: '',
    force_update: false,
    update_message: '',
    app_store_url: '',
  })
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    fetchAppVersion()
  }, [])

  const fetchAppVersion = async () => {
    try {
      const { data, error } = await supabase
        .from('app_version')
        .select('*')
        .single()

      if (error) throw error

      if (data) {
        setAppVersion(data)
        setFormData({
          minimum_version: data.minimum_version || '',
          latest_version: data.latest_version || '',
          force_update: data.force_update || false,
          update_message: data.update_message || '',
          app_store_url: data.app_store_url || '',
        })
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la version:', error)
      toast.error('Erreur lors du chargement de la version de l\'application')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!appVersion) return

    // Validation basique
    if (!formData.minimum_version || !formData.latest_version) {
      toast.error('Les versions minimale et dernière sont requises')
      return
    }

    // Validation du format de version (X.X.X)
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
        .eq('id', appVersion.id)

      if (error) throw error

      toast.success('Version de l\'application mise à jour avec succès')
      await fetchAppVersion()
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
          <h1 className="text-3xl font-bold text-foreground">Gestion des versions de l'application</h1>
          <p className="text-muted-foreground">Contrôlez les versions minimales et forcez les mises à jour</p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Information importante
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Ces paramètres contrôlent les versions de l'application mobile Fady.
                La version minimale définit la version en dessous de laquelle l'app ne fonctionnera pas.
                Activez "Forcer la mise à jour" pour obliger tous les utilisateurs à mettre à jour vers la dernière version.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Version Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5" />
            <span>Configuration des versions</span>
          </CardTitle>
          <CardDescription>
            Dernière mise à jour : {appVersion ? new Date(appVersion.updated_at).toLocaleString('fr-FR') : 'N/A'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Version Numbers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="minimum_version">
                Version minimale requise <span className="text-destructive">*</span>
              </Label>
              <Input
                id="minimum_version"
                placeholder="1.0.0"
                value={formData.minimum_version}
                onChange={(e) => setFormData({ ...formData, minimum_version: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Les utilisateurs avec une version inférieure seront obligés de mettre à jour
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="latest_version">
                Dernière version disponible <span className="text-destructive">*</span>
              </Label>
              <Input
                id="latest_version"
                placeholder="1.0.6"
                value={formData.latest_version}
                onChange={(e) => setFormData({ ...formData, latest_version: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Version actuelle disponible sur l'App Store
              </p>
            </div>
          </div>

          {/* Force Update Switch */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="force_update" className="text-base">
                Forcer la mise à jour
              </Label>
              <p className="text-sm text-muted-foreground">
                Oblige tous les utilisateurs à installer la dernière version
              </p>
            </div>
            <Switch
              id="force_update"
              checked={formData.force_update}
              onCheckedChange={(checked) => setFormData({ ...formData, force_update: checked })}
            />
          </div>

          {/* Update Message */}
          <div className="space-y-2">
            <Label htmlFor="update_message">
              Message de mise à jour
            </Label>
            <Textarea
              id="update_message"
              placeholder="Une nouvelle version de Fady est disponible..."
              value={formData.update_message}
              onChange={(e) => setFormData({ ...formData, update_message: e.target.value })}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Ce message sera affiché aux utilisateurs lorsqu'une mise à jour est disponible
            </p>
          </div>

          {/* App Store URL */}
          <div className="space-y-2">
            <Label htmlFor="app_store_url">
              URL de l'App Store
            </Label>
            <Input
              id="app_store_url"
              placeholder="https://apps.apple.com/fr/app/fady-coiffure/id..."
              value={formData.app_store_url}
              onChange={(e) => setFormData({ ...formData, app_store_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Lien vers la page de l'application sur l'App Store
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
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
            <span>État actuel</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Version minimale</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{appVersion?.minimum_version}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Version actuelle</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{appVersion?.latest_version}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Mise à jour forcée</p>
              <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                {appVersion?.force_update ? '✓ Activée' : '✗ Désactivée'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Dernière modification</p>
              <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                {appVersion ? new Date(appVersion.updated_at).toLocaleDateString('fr-FR') : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
