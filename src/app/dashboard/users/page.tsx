'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Users, Search, Mail, Phone, Calendar, Eye } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'

type User = Database['public']['Tables']['users']['Row']

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = users

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.includes(searchTerm)
      )
    }

    setFilteredUsers(filtered)
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
        <h1 className="text-3xl font-bold text-foreground">Utilisateurs</h1>
        <p className="text-muted-foreground">Liste des utilisateurs clients de la plateforme</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher par email, nom ou téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Utilisateurs ({filteredUsers.length})</span>
          </CardTitle>
          <CardDescription>
            Liste des utilisateurs inscrits sur la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email confirmé</TableHead>
                  <TableHead>Date d'inscription</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                    className="transition-colors"
                  >
                    <TableCell className="font-medium flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{user.email}</span>
                    </TableCell>
                    <TableCell>
                      {user.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {user.phone ? (
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{user.phone}</span>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {user.email_confirmed ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">Confirmé</Badge>
                      ) : (
                        <Badge variant="secondary">Non confirmé</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{new Date(user.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/users/${user.id}`)}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Voir</span>
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
