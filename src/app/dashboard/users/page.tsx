'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Users, Search, Mail, Phone, Calendar, Eye, Scissors, User } from 'lucide-react'
import { Database } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'

type User = Database['public']['Tables']['users']['Row']

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'hairdresser' | 'client'>('all')
  const [hairdresserUserIds, setHairdresserUserIds] = useState<Set<string>>(new Set())
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, userTypeFilter, hairdresserUserIds])

  const fetchUsers = async () => {
    try {
      // Récupérer les utilisateurs
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])

      // Récupérer les IDs des coiffeurs
      const { data: hairdressers, error: hairdressersError } = await supabase
        .from('hairdressers')
        .select('user_id')

      if (hairdressersError) throw hairdressersError

      // Créer un Set des user_ids qui sont coiffeurs
      const hairdresserIds = new Set(
        hairdressers
          ?.map(h => h.user_id)
          .filter((id): id is string => id !== null) || []
      )
      setHairdresserUserIds(hairdresserIds)
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = users

    // Filtre par type d'utilisateur
    if (userTypeFilter === 'hairdresser') {
      filtered = filtered.filter(user => hairdresserUserIds.has(user.id))
    } else if (userTypeFilter === 'client') {
      filtered = filtered.filter(user => !hairdresserUserIds.has(user.id))
    }

    // Filtre par recherche
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.includes(searchTerm)
      )
    }

    setFilteredUsers(filtered)
  }

  const isHairdresser = (userId: string) => {
    return hairdresserUserIds.has(userId)
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

      {/* Filtres de type d'utilisateur */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-muted-foreground">Type d'utilisateur:</span>
            <Button
              variant={userTypeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUserTypeFilter('all')}
              className="flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Tous ({users.length})</span>
            </Button>
            <Button
              variant={userTypeFilter === 'hairdresser' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUserTypeFilter('hairdresser')}
              className="flex items-center space-x-2"
            >
              <Scissors className="w-4 h-4" />
              <span>Coiffeurs ({users.filter(u => hairdresserUserIds.has(u.id)).length})</span>
            </Button>
            <Button
              variant={userTypeFilter === 'client' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUserTypeFilter('client')}
              className="flex items-center space-x-2"
            >
              <User className="w-4 h-4" />
              <span>Clients ({users.filter(u => !hairdresserUserIds.has(u.id)).length})</span>
            </Button>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Date de naissance</TableHead>
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
                    <TableCell>
                      {isHairdresser(user.id) ? (
                        <div className="flex items-center space-x-2">
                          <Scissors className="w-4 h-4 text-primary" />
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            Coiffeur
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
                            Client
                          </Badge>
                        </div>
                      )}
                    </TableCell>
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
                      {user.gender ? (
                        <Badge variant="outline">
                          {user.gender === 'homme' ? 'Homme' : 
                           user.gender === 'femme' ? 'Femme' : 
                           user.gender === 'autre' ? 'Autre' : 
                           'Non spécifié'}
                        </Badge>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {user.birth_date ? (
                        <span>{new Date(user.birth_date).toLocaleDateString('fr-FR')}</span>
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
