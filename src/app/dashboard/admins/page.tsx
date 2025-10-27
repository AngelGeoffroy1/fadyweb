'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { motion } from 'framer-motion'
import { Settings, Plus, Trash2, UserPlus, Search } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { toast } from 'sonner'

type Admin = {
  id: string
  user_id: string
  role: string | null
  created_at: string | null
  created_by: string | null
  email: string
  full_name: string | null
  user_created_at: string
  created_by_email: string | null
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchAdmins()
  }, [])

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('admins_with_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAdmins(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des admins:', error)
      toast.error('Erreur lors du chargement des administrateurs')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return

    setAddLoading(true)
    try {
      // Vérifier si l'utilisateur existe dans auth.users
      const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(newAdminEmail)

      if (userError || !userData.user) {
        toast.error('Utilisateur non trouvé avec cet email')
        return
      }

      // Vérifier si l'utilisateur est déjà admin
      const { data: existingAdmin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', userData.user.id)
        .single()

      if (existingAdmin) {
        toast.error('Cet utilisateur est déjà administrateur')
        return
      }

      // Récupérer l'ID de l'admin actuel
      const { data: { user } } = await supabase.auth.getUser()
      const { data: currentAdmin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      // Créer l'admin
      const { error } = await supabase
        .from('admins')
        .insert({
          user_id: userData.user.id,
          role: 'admin',
          created_by: currentAdmin?.id || null
        })

      if (error) throw error

      toast.success('Administrateur ajouté avec succès')
      setNewAdminEmail('')
      setIsAddDialogOpen(false)
      await fetchAdmins()
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'admin:', error)
      toast.error('Erreur lors de l\'ajout de l\'administrateur')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteAdmin = async (adminId: string, adminEmail: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir retirer les droits d'administrateur à ${adminEmail} ?`)) {
      return
    }

    setDeleteLoading(adminId)
    try {
      const { error } = await supabase
        .from('admins')
        .delete()
        .eq('id', adminId)

      if (error) throw error

      toast.success('Administrateur retiré avec succès')
      await fetchAdmins()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      toast.error('Erreur lors de la suppression de l\'administrateur')
    } finally {
      setDeleteLoading(null)
    }
  }

  const filteredAdmins = admins.filter(admin =>
    admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <h1 className="text-3xl font-bold text-foreground">Gestion des administrateurs</h1>
          <p className="text-muted-foreground">Gérer les accès administrateur à la plateforme</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="transition-all duration-200 hover:scale-105">
              <UserPlus className="w-4 h-4 mr-2" />
              Ajouter un admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un administrateur</DialogTitle>
              <DialogDescription>
                Saisissez l'email d'un utilisateur existant pour lui donner les droits d'administrateur
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email de l'utilisateur</label>
                <Input
                  type="email"
                  placeholder="utilisateur@example.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddAdmin}
                disabled={addLoading || !newAdminEmail.trim()}
                className="transition-all duration-200 hover:scale-105"
              >
                {addLoading ? 'Ajout...' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher par email ou nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Admins Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Administrateurs ({filteredAdmins.length})</span>
          </CardTitle>
          <CardDescription>
            Liste des utilisateurs ayant les droits d'administrateur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Date d'ajout</TableHead>
                  <TableHead>Ajouté par</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((admin) => (
                  <motion.tr
                    key={admin.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell className="font-medium">
                      {admin.email}
                    </TableCell>
                    <TableCell>
                      {admin.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {admin.role || 'admin'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {admin.created_at ? new Date(admin.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {admin.created_by_email || 'Système'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                        disabled={deleteLoading === admin.id}
                        className="transition-all duration-200 hover:scale-105 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        {deleteLoading === admin.id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAdmins.length === 0 && (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun administrateur trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
